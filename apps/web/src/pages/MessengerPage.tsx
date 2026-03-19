import { useEffect, useCallback, useRef, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { EmptyChat } from '@/components/chat/EmptyChat'
import { IncomingCallModal } from '@/components/call/IncomingCallModal'
import { ActiveCallScreen } from '@/components/call/ActiveCallScreen'
import { MinimizedCallBar } from '@/components/call/MinimizedCallBar'
import { GroupCallScreen } from '@/components/call/GroupCallScreen'
import { GroupCallMinimizedBar } from '@/components/call/GroupCallMinimizedBar'
import {
  useWebSocket,
  registerWebRTCHandler,
  registerCallAcceptedHandler,
  registerRemoteCallEndedHandler,
  registerGroupWebRTCHandler,
  registerGroupMemberLeftHandler,
  _groupJoinedHandlers,
  getBufferedOffer,
  clearBufferedOffer,
} from '@/hooks/useWebSocket'
import { useWebRTC, getLocalStream } from '@/hooks/useWebRTC'
import { useGroupWebRTC } from '@/hooks/useGroupWebRTC'
import { useChatStore } from '@/store/chat'
import { useCallStore } from '@/store/call'
import { useGroupCallStore } from '@/store/groupCall'
import { useAuthStore } from '@/store/auth'
import { chatApi } from '@/api/chat'
import { generateId } from '@/utils/uuid'

export function MessengerPage() {
  const setChats = useChatStore((s) => s.setChats)
  const currentUser = useAuthStore((s) => s.user)
  const { send } = useWebSocket()
  const { answerCall, handleAnswer, handleICE, hangup, toggleMute, toggleVideo, sendOffer, closePeerConnection } = useWebRTC(send)
  const { joinAndOffer, handleOffer: groupHandleOffer, handleAnswer: groupHandleAnswer, handleIce: groupHandleIce, participantLeft, leave: groupLeave, callIdRef: groupCallIdRef } = useGroupWebRTC(send)

  const incoming = useCallStore((s) => s.incoming)
  const active = useCallStore((s) => s.active)
  const setIncoming = useCallStore((s) => s.setIncoming)
  const setActive = useCallStore((s) => s.setActive)
  const updateActive = useCallStore((s) => s.updateActive)
  const clearAll = useCallStore((s) => s.clearAll)

  const groupActive = useGroupCallStore((s) => s.active)
  const groupJoinCall = useGroupCallStore((s) => s.joinCall)
  const groupSetMuted = useGroupCallStore((s) => s.setMuted)
  const groupSetVideoOff = useGroupCallStore((s) => s.setVideoOff)
  const groupSetMinimized = useGroupCallStore((s) => s.setMinimized)
  const removeLiveCall = useGroupCallStore((s) => s.removeLiveCall)

  const [isCallMinimized, setIsCallMinimized] = useState(false)

  // Таймаут звонка — если нет ответа 45 сек, вешаем трубку
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    chatApi.getChats()
      .then(({ data }) => setChats(data ?? []))
      .catch(() => setChats([]))
  }, [])

  // WebRTC signaling — caller side (answer + ice)
  useEffect(() => {
    registerWebRTCHandler(async (subType, _from, data) => {
      console.log('[WebRTC] received:', subType)
      if (subType === 'webrtc_answer') await handleAnswer(data as RTCSessionDescriptionInit)
      else if (subType === 'webrtc_ice') await handleICE(data as RTCIceCandidateInit)
    })
    return () => registerWebRTCHandler(null)
  }, [handleAnswer, handleICE])

  // When remote ends or declines the call — close our PC (tracks stopped by clearAll in store)
  useEffect(() => {
    registerRemoteCallEndedHandler(() => {
      clearTimeout(callTimeoutRef.current)
      closePeerConnection()
    })
    return () => registerRemoteCallEndedHandler(null)
  }, [closePeerConnection])

  // Group call: member left → close peer connection
  useEffect(() => {
    registerGroupMemberLeftHandler((userId) => participantLeft(userId))
    return () => registerGroupMemberLeftHandler(null)
  }, [participantLeft])

  // Group call WebRTC signaling
  useEffect(() => {
    registerGroupWebRTCHandler(async (subType, from, data, _callId) => {
      const localStream = useGroupCallStore.getState().active?.localStream
      if (!localStream) return
      // Find the participant name for this user (from liveCall state)
      const liveCallEntries = useGroupCallStore.getState().liveCalls
      let fromName = from
      for (const lc of Object.values(liveCallEntries)) {
        const p = lc.participants.find((x) => x.userId === from)
        if (p) { fromName = p.userName; break }
      }
      if (subType === 'group_webrtc_offer') {
        await groupHandleOffer(from, fromName, data as RTCSessionDescriptionInit, localStream)
      } else if (subType === 'group_webrtc_answer') {
        await groupHandleAnswer(from, data as RTCSessionDescriptionInit)
      } else if (subType === 'group_webrtc_ice') {
        await groupHandleIce(from, data as RTCIceCandidateInit)
      }
    })
    return () => registerGroupWebRTCHandler(null)
  }, [groupHandleOffer, groupHandleAnswer, groupHandleIce])

  // ── Групповой звонок ────────────────────────────────────────
  const handleStartGroupCall = useCallback(async (chatId: string) => {
    const callId = generateId()
    const userName = currentUser
      ? `${currentUser.first_name}${currentUser.last_name ? ' ' + currentUser.last_name : ''}`
      : 'Unknown'

    let stream: MediaStream
    try {
      stream = await getLocalStream('voice')
    } catch (err: any) {
      alert(`Ошибка доступа к микрофону: ${err?.message ?? err}`)
      return
    }

    groupJoinCall(callId, chatId, stream)

    // Tell server we joined; it returns current participants via group_call_joined
    send('group_call_join', { chat_id: chatId, call_id: callId, user_name: userName })

    // group_call_joined arrives via WebSocket → triggers joinAndOffer
    // We register a one-time handler for it
    const onJoined = async (existingParticipants: { userId: string; userName: string }[]) => {
      await joinAndOffer(callId, existingParticipants, stream)
    }
    _groupJoinedHandlers.set(callId, onJoined)
  }, [send, currentUser, groupJoinCall, joinAndOffer])

  const handleJoinGroupCall = useCallback(async (chatId: string, callId: string) => {
    const userName = currentUser
      ? `${currentUser.first_name}${currentUser.last_name ? ' ' + currentUser.last_name : ''}`
      : 'Unknown'

    let stream: MediaStream
    try {
      stream = await getLocalStream('voice')
    } catch (err: any) {
      alert(`Ошибка доступа к микрофону: ${err?.message ?? err}`)
      return
    }

    groupJoinCall(callId, chatId, stream)
    send('group_call_join', { chat_id: chatId, call_id: callId, user_name: userName })

    const onJoined = async (existingParticipants: { userId: string; userName: string }[]) => {
      await joinAndOffer(callId, existingParticipants, stream)
    }
    _groupJoinedHandlers.set(callId, onJoined)
  }, [send, currentUser, groupJoinCall, joinAndOffer])

  const handleLeaveGroupCall = useCallback(() => {
    const state = useGroupCallStore.getState().active
    if (!state) return
    send('group_call_leave', { chat_id: state.chatId, call_id: state.callId })
    groupLeave()
    removeLiveCall(state.chatId)
  }, [send, groupLeave, removeLiveCall])

  const handleGroupToggleMute = useCallback(() => {
    const state = useGroupCallStore.getState().active
    if (!state?.localStream) return
    const next = !state.isMuted
    state.localStream.getAudioTracks().forEach((t) => { t.enabled = !next })
    groupSetMuted(next)
  }, [groupSetMuted])

  const handleGroupToggleVideo = useCallback(() => {
    const state = useGroupCallStore.getState().active
    if (!state?.localStream) return
    const next = !state.isVideoOff
    state.localStream.getVideoTracks().forEach((t) => { t.enabled = !next })
    groupSetVideoOff(next)
  }, [groupSetVideoOff])

  // ── Исходящий звонок ────────────────────────────────────────
  const handleStartCall = useCallback(async (targetId: string, targetName: string, type: 'voice' | 'video') => {
    const callId = generateId()
    const callerName = currentUser
      ? `${currentUser.first_name}${currentUser.last_name ? ' ' + currentUser.last_name : ''}`
      : 'Unknown'

    // 1. Сразу запрашиваем разрешения на микрофон/камеру
    let stream: MediaStream
    try {
      stream = await getLocalStream(type)
    } catch (err: any) {
      console.error('[Call] getLocalStream failed:', err)
      const msg = err?.message === 'insecure-context'
        ? 'Звонки работают только по HTTPS или на localhost.\n\nОткрой сайт через https:// или настрой SSL на сервере.'
        : err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'Доступ к микрофону/камере запрещён. Нажми на иконку замка в адресной строке и разрешите доступ.'
        : err?.name === 'NotFoundError'
        ? 'Микрофон или камера не найдены. Подключите устройство и попробуйте снова.'
        : `Ошибка доступа к камере/микрофону: ${err?.message ?? err}`
      alert(msg)
      return
    }

    // 2. Показываем UI звонка с локальным стримом
    setActive({
      callId, targetId, targetName, type,
      status: 'ringing',
      isInitiator: true,
      isMuted: false, isVideoOff: false, isSpeakerOn: true,
      localStream: stream, remoteStream: null,
    })

    // 3. Уведомляем другого пользователя
    console.log('[Call] initiating call to', targetId)
    send('call_initiate', { target_user_id: targetId, call_id: callId, call_type: type, caller_name: callerName })

    // 4. Таймаут 45 сек — нет ответа → сбрасываем
    clearTimeout(callTimeoutRef.current)
    callTimeoutRef.current = setTimeout(() => {
      const cur = useCallStore.getState().active
      if (cur?.callId === callId && cur.status === 'ringing') {
        send('call_end', { target_id: targetId, call_id: callId })
        stream.getTracks().forEach((t) => t.stop())
        clearAll()
      }
    }, 45_000)

    // 5. Когда callee принимает → отправляем WebRTC offer
    registerCallAcceptedHandler(async () => {
      registerCallAcceptedHandler(null)
      clearTimeout(callTimeoutRef.current)
      console.log('[Call] accepted, sending WebRTC offer')
      await sendOffer(callId, targetId, stream)
    })
  }, [send, sendOffer, setActive, clearAll, currentUser])

  // ── Принять входящий звонок ────────────────────────────────
  const handleAccept = useCallback(async (type: 'voice' | 'video') => {
    if (!incoming) return
    const snap = incoming

    // 1. Запрашиваем разрешения
    let stream: MediaStream
    try {
      stream = await getLocalStream(type)
    } catch (err: any) {
      console.error('[Call] getLocalStream failed:', err)
      const msg = err?.message === 'insecure-context'
        ? 'Звонки работают только по HTTPS или на localhost.'
        : err?.name === 'NotAllowedError'
        ? 'Доступ к микрофону/камере запрещён. Разрешите доступ в настройках браузера.'
        : `Ошибка доступа к камере/микрофону: ${err?.message ?? err}`
      alert(msg)
      return
    }

    // 2. Показываем UI
    setActive({
      callId: snap.callId, targetId: snap.callerId, targetName: snap.callerName,
      type, status: 'connecting',
      isInitiator: false,
      isMuted: false, isVideoOff: false, isSpeakerOn: true,
      localStream: stream, remoteStream: null,
    })
    setIncoming(null)

    // 3. Отвечаем серверу
    send('call_accept', { caller_id: snap.callerId, call_id: snap.callId })

    // 4. Обрабатываем WebRTC offer (может прийти до или после accept)
    const doAnswer = async (data: unknown) => {
      console.log('[Call] answering offer')
      await answerCall(snap.callId, snap.callerId, data as RTCSessionDescriptionInit, type, stream)
      registerWebRTCHandler(async (subType, _from, d) => {
        if (subType === 'webrtc_ice') await handleICE(d as RTCIceCandidateInit)
      })
    }

    registerWebRTCHandler(async (subType, _from, data) => {
      if (subType === 'webrtc_offer') await doAnswer(data)
      else if (subType === 'webrtc_ice') await handleICE(data as RTCIceCandidateInit)
    })

    // Если offer уже пришёл до нажатия "принять"
    const buffered = getBufferedOffer()
    if (buffered && buffered.callId === snap.callId && buffered.subType === 'webrtc_offer') {
      clearBufferedOffer()
      await doAnswer(buffered.data)
    }
  }, [incoming, send, answerCall, handleICE, setActive, setIncoming])

  // ── Отклонить ──────────────────────────────────────────────
  const handleDecline = useCallback(() => {
    if (!incoming) return
    send('call_decline', { caller_id: incoming.callerId, call_id: incoming.callId })
    clearAll()
  }, [incoming, send, clearAll])

  // ── Завершить ──────────────────────────────────────────────
  const handleHangup = useCallback(() => {
    clearTimeout(callTimeoutRef.current)
    setIsCallMinimized(false)
    hangup()
    clearAll()
  }, [hangup, clearAll])

  return (
    <div className="flex h-full bg-white dark:bg-surface-dark overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<EmptyChat />} />
          <Route path="chat/:chatId" element={
            <ChatWindow
              onStartCall={handleStartCall}
              onStartGroupCall={handleStartGroupCall}
              onJoinGroupCall={handleJoinGroupCall}
            />
          } />
        </Routes>
      </main>

      {incoming && (
        <IncomingCallModal onAccept={handleAccept} onDecline={handleDecline} />
      )}
      {active && active.status !== 'ended' && !isCallMinimized && (
        <ActiveCallScreen
          onHangup={handleHangup}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onMinimize={() => setIsCallMinimized(true)}
        />
      )}
      {active && active.status !== 'ended' && isCallMinimized && (
        <MinimizedCallBar
          onHangup={handleHangup}
          onToggleMute={toggleMute}
          onExpand={() => setIsCallMinimized(false)}
        />
      )}

      {/* Group call UI */}
      {groupActive && !groupActive.isMinimized && (
        <GroupCallScreen
          onLeave={handleLeaveGroupCall}
          onToggleMute={handleGroupToggleMute}
          onToggleVideo={handleGroupToggleVideo}
          onMinimize={() => groupSetMinimized(true)}
        />
      )}
      {groupActive && groupActive.isMinimized && (
        <GroupCallMinimizedBar
          onLeave={handleLeaveGroupCall}
          onToggleMute={handleGroupToggleMute}
          onExpand={() => groupSetMinimized(false)}
        />
      )}
    </div>
  )
}
