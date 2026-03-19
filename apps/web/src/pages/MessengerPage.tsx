import { useEffect, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { EmptyChat } from '@/components/chat/EmptyChat'
import { IncomingCallModal } from '@/components/call/IncomingCallModal'
import { ActiveCallScreen } from '@/components/call/ActiveCallScreen'
import { useWebSocket, registerWebRTCHandler, registerCallAcceptedHandler, getBufferedOffer, clearBufferedOffer } from '@/hooks/useWebSocket'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useChatStore } from '@/store/chat'
import { useCallStore } from '@/store/call'
import { useAuthStore } from '@/store/auth'
import { chatApi } from '@/api/chat'
import { generateId } from '@/utils/uuid'

export function MessengerPage() {
  const setChats = useChatStore((s) => s.setChats)
  const currentUser = useAuthStore((s) => s.user)
  const { send } = useWebSocket()
  const { startCall, answerCall, handleAnswer, handleICE, hangup, toggleMute, toggleVideo } = useWebRTC(send)

  const incoming = useCallStore((s) => s.incoming)
  const active = useCallStore((s) => s.active)
  const setIncoming = useCallStore((s) => s.setIncoming)
  const setActive = useCallStore((s) => s.setActive)
  const clearAll = useCallStore((s) => s.clearAll)
  useEffect(() => {
    chatApi.getChats()
      .then(({ data }) => setChats(data ?? []))
      .catch(() => setChats([]))
  }, [])

  // Wire WebRTC signaling through the WS handler (caller side: answer + ice only)
  useEffect(() => {
    registerWebRTCHandler(async (subType, _from, data) => {
      if (subType === 'webrtc_answer') await handleAnswer(data as RTCSessionDescriptionInit)
      else if (subType === 'webrtc_ice') await handleICE(data as RTCIceCandidateInit)
    })
    return () => registerWebRTCHandler(null)
  }, [handleAnswer, handleICE])

  // Initiate an outgoing call
  const handleStartCall = useCallback(async (targetId: string, targetName: string, type: 'voice' | 'video') => {
    const callId = generateId()
    const callerName = currentUser
      ? `${currentUser.first_name}${currentUser.last_name ? ' ' + currentUser.last_name : ''}`
      : 'Unknown'
    setActive({ callId, targetId, targetName, type, status: 'ringing', isMuted: false, isVideoOff: false, isSpeakerOn: true, localStream: null, remoteStream: null })
    send('call_initiate', { target_user_id: targetId, call_id: callId, call_type: type, caller_name: callerName })

    // When callee accepts → THEN send WebRTC offer
    registerCallAcceptedHandler(async () => {
      registerCallAcceptedHandler(null)
      await startCall(callId, targetId, type)
    })
  }, [send, startCall, setActive, currentUser])

  // Accept incoming call
  const handleAccept = useCallback(async (type: 'voice' | 'video') => {
    if (!incoming) return
    const snap = incoming // snapshot to avoid stale closure
    setActive({ callId: snap.callId, targetId: snap.callerId, targetName: snap.callerName, type, status: 'connecting', isMuted: false, isVideoOff: false, isSpeakerOn: true, localStream: null, remoteStream: null })
    setIncoming(null)
    send('call_accept', { caller_id: snap.callerId, call_id: snap.callId })

    const doAnswer = async (data: unknown) => {
      await answerCall(snap.callId, snap.callerId, data as RTCSessionDescriptionInit, type)
      registerWebRTCHandler(async (subType, _from, d) => {
        if (subType === 'webrtc_ice') await handleICE(d as RTCIceCandidateInit)
      })
    }

    // Register handler for offer that may come after accept
    registerWebRTCHandler(async (subType, _from, data) => {
      if (subType === 'webrtc_offer') await doAnswer(data)
      else if (subType === 'webrtc_ice') await handleICE(data as RTCIceCandidateInit)
    })

    // If offer already buffered before accept, process now
    const buffered = getBufferedOffer()
    if (buffered && buffered.callId === snap.callId && buffered.subType === 'webrtc_offer') {
      clearBufferedOffer()
      await doAnswer(buffered.data)
    }
  }, [incoming, send, answerCall, handleICE, setActive, setIncoming])

  // Decline incoming call
  const handleDecline = useCallback(() => {
    if (!incoming) return
    send('call_decline', { caller_id: incoming.callerId, call_id: incoming.callId })
    clearAll()
  }, [incoming, send, clearAll])

  // Hang up active call
  const handleHangup = useCallback(() => {
    hangup()
    clearAll()
  }, [hangup, clearAll])

  return (
    <div className="flex h-full bg-white dark:bg-surface-dark overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<EmptyChat />} />
          <Route path="chat/:chatId" element={<ChatWindow onStartCall={handleStartCall} />} />
        </Routes>
      </main>

      {/* Call overlays */}
      {incoming && (
        <IncomingCallModal onAccept={handleAccept} onDecline={handleDecline} />
      )}
      {active && active.status !== 'ended' && (
        <ActiveCallScreen
          onHangup={handleHangup}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
        />
      )}
    </div>
  )
}
