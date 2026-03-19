import { useEffect, useCallback, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { EmptyChat } from '@/components/chat/EmptyChat'
import { IncomingCallModal } from '@/components/call/IncomingCallModal'
import { ActiveCallScreen } from '@/components/call/ActiveCallScreen'
import {
  useWebSocket,
  registerWebRTCHandler,
  registerCallAcceptedHandler,
  registerRemoteCallEndedHandler,
  getBufferedOffer,
  clearBufferedOffer,
} from '@/hooks/useWebSocket'
import { useWebRTC, getLocalStream } from '@/hooks/useWebRTC'
import { useChatStore } from '@/store/chat'
import { useCallStore } from '@/store/call'
import { useAuthStore } from '@/store/auth'
import { chatApi } from '@/api/chat'
import { generateId } from '@/utils/uuid'

export function MessengerPage() {
  const setChats = useChatStore((s) => s.setChats)
  const currentUser = useAuthStore((s) => s.user)
  const { send } = useWebSocket()
  const { answerCall, handleAnswer, handleICE, hangup, toggleMute, toggleVideo, sendOffer, closePeerConnection } = useWebRTC(send)


  const incoming = useCallStore((s) => s.incoming)
  const active = useCallStore((s) => s.active)
  const setIncoming = useCallStore((s) => s.setIncoming)
  const setActive = useCallStore((s) => s.setActive)
  const updateActive = useCallStore((s) => s.updateActive)
  const clearAll = useCallStore((s) => s.clearAll)

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
