import { useRef, useCallback } from 'react'
import { useCallStore } from '@/store/call'

// TURN server is on the same host as the app (coturn container)
function getIceServers(): RTCIceServer[] {
  const host = window.location.hostname
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    // TURN relay — works even behind symmetric NAT
    {
      urls: `turn:${host}:3478`,
      username: 'zlp',
      credential: 'zlp_turn_secret',
    },
  ]
}

// How long to wait for WebRTC connection after signaling (ms)
const CONNECT_TIMEOUT_MS = 20_000
// Delay before attempting ICE restart after disconnection (ms)
const RECONNECT_DELAY_MS = 3_000
// Max ICE restart attempts before giving up
const MAX_RECONNECT_ATTEMPTS = 3

type SendFn = (type: string, payload: unknown) => void

export function useWebRTC(send: SendFn) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pendingICERef = useRef<RTCIceCandidateInit[]>([])
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const callIdRef = useRef<string>('')
  const targetIdRef = useRef<string>('')

  const updateActive = useCallStore((s) => s.updateActive)

  // ── Teardown: notify other side, stop tracks, close PC ───

  // Stored in a ref so it can be called from inside PC event handlers
  // without circular useCallback dependencies
  const closeCallRef = useRef<() => void>(() => {})

  const closeCall = useCallback(() => {
    clearTimeout(reconnectTimerRef.current)
    clearTimeout(connectTimeoutRef.current)
    const active = useCallStore.getState().active
    if (active) {
      send('call_end', { target_id: active.targetId, call_id: active.callId })
      active.localStream?.getTracks().forEach((t) => t.stop())
    }
    pcRef.current?.close()
    pcRef.current = null
    useCallStore.getState().clearAll()
  }, [send])

  // Keep the ref current so PC handlers can always call the latest version
  closeCallRef.current = closeCall

  // ── ICE restart (initiator only) ──────────────────────────

  const doIceRestart = useCallback(async () => {
    const pc = pcRef.current
    if (!pc || !callIdRef.current || !targetIdRef.current) return
    pendingICERef.current = []
    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)
      send('webrtc_offer', {
        target_user_id: targetIdRef.current,
        call_id: callIdRef.current,
        data: offer,
      })
    } catch { /* ignore */ }
  }, [send])

  // ── Create peer connection ────────────────────────────────

  const createPC = useCallback((callId: string, targetId: string) => {
    if (pcRef.current) {
      pcRef.current.close()
    }
    callIdRef.current = callId
    targetIdRef.current = targetId
    pendingICERef.current = []
    reconnectAttemptsRef.current = 0
    clearTimeout(reconnectTimerRef.current)
    clearTimeout(connectTimeoutRef.current)

    const pc = new RTCPeerConnection({ iceServers: getIceServers() })
    pcRef.current = pc

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send('webrtc_ice', {
          target_user_id: targetId,
          call_id: callId,
          data: e.candidate,
        })
      }
    }

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0]
      if (remoteStream) {
        clearTimeout(connectTimeoutRef.current)
        updateActive({ remoteStream, status: 'active', startedAt: Date.now() })
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      // Guard: if this PC is no longer the active one, ignore
      if (pc !== pcRef.current) return

      const isInitiator = useCallStore.getState().active?.isInitiator

      if (state === 'connected') {
        clearTimeout(reconnectTimerRef.current)
        clearTimeout(connectTimeoutRef.current)
        reconnectAttemptsRef.current = 0

      } else if (state === 'disconnected') {
        updateActive({ status: 'reconnecting' })
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(async () => {
          if (pc !== pcRef.current || pc.connectionState === 'connected') return
          if (isInitiator) {
            reconnectAttemptsRef.current++
            await doIceRestart()
          }
        }, RECONNECT_DELAY_MS)

      } else if (state === 'failed') {
        clearTimeout(reconnectTimerRef.current)
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && isInitiator) {
          reconnectAttemptsRef.current++
          reconnectTimerRef.current = setTimeout(async () => {
            if (pc !== pcRef.current) return
            await doIceRestart()
          }, RECONNECT_DELAY_MS)
        } else {
          // Permanently failed — notify the other side and end the call
          closeCallRef.current()
        }
      }
    }

    return pc
  }, [send, updateActive, doIceRestart])

  // ── Connection timeout: end call if no stream in time ────

  const startConnectTimeout = useCallback(() => {
    clearTimeout(connectTimeoutRef.current)
    connectTimeoutRef.current = setTimeout(() => {
      if (!useCallStore.getState().active?.remoteStream) {
        // Timed out — notify the other side and clean up
        closeCallRef.current()
      }
    }, CONNECT_TIMEOUT_MS)
  }, [])

  // ── Callee: answer ────────────────────────────────────────

  const answerCall = useCallback(async (
    callId: string,
    callerId: string,
    offer: RTCSessionDescriptionInit,
    type: 'voice' | 'video',
    existingStream?: MediaStream,
  ) => {
    const stream = existingStream ?? await getLocalStream(type)
    updateActive({ localStream: stream })

    const pc = createPC(callId, callerId)
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    for (const c of pendingICERef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    }
    pendingICERef.current = []

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    startConnectTimeout()

    send('webrtc_answer', { target_user_id: callerId, call_id: callId, data: answer })
    return stream
  }, [createPC, send, updateActive, startConnectTimeout])

  // ── Handle answer from callee ─────────────────────────────

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = pcRef.current
    if (!pc) return
    await pc.setRemoteDescription(new RTCSessionDescription(answer))
    for (const c of pendingICERef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    }
    pendingICERef.current = []
  }, [])

  // ── Handle ICE candidate ──────────────────────────────────

  const handleICE = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current
    if (!pc) return
    if (!pc.remoteDescription) {
      pendingICERef.current.push(candidate)
      return
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch { /* ignore */ }
  }, [])

  // ── Hang up (user-initiated) ──────────────────────────────

  const hangup = useCallback(() => {
    clearTimeout(reconnectTimerRef.current)
    clearTimeout(connectTimeoutRef.current)
    const active = useCallStore.getState().active
    if (active) {
      send('call_end', { target_id: active.targetId, call_id: active.callId })
      active.localStream?.getTracks().forEach((t) => t.stop())
    }
    pcRef.current?.close()
    pcRef.current = null
  }, [send])

  // ── Toggle mute ───────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const active = useCallStore.getState().active
    if (!active?.localStream) return
    const isMuted = !active.isMuted
    active.localStream.getAudioTracks().forEach((t) => { t.enabled = !isMuted })
    updateActive({ isMuted })
  }, [updateActive])

  // ── Toggle video ──────────────────────────────────────────

  const toggleVideo = useCallback(() => {
    const active = useCallStore.getState().active
    if (!active?.localStream) return
    const isVideoOff = !active.isVideoOff
    active.localStream.getVideoTracks().forEach((t) => { t.enabled = !isVideoOff })
    updateActive({ isVideoOff })
  }, [updateActive])

  // ── Send offer (caller, after call_accepted) ──────────────

  const sendOffer = useCallback(async (
    callId: string,
    targetId: string,
    stream: MediaStream,
  ) => {
    const pc = createPC(callId, targetId)
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    startConnectTimeout()
    send('webrtc_offer', { target_user_id: targetId, call_id: callId, data: offer })
  }, [createPC, send, startConnectTimeout])

  // Called when remote side ends the call — only close PC, don't send WS event
  // (tracks are stopped by clearAll() in the store)
  const closePeerConnection = useCallback(() => {
    clearTimeout(reconnectTimerRef.current)
    clearTimeout(connectTimeoutRef.current)
    pcRef.current?.close()
    pcRef.current = null
  }, [])

  return { answerCall, handleAnswer, handleICE, hangup, toggleMute, toggleVideo, sendOffer, closePeerConnection }
}

export async function getLocalStream(type: 'voice' | 'video'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      window.isSecureContext === false
        ? 'insecure-context'
        : 'api-unavailable'
    )
  }
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video' ? { width: 1280, height: 720, facingMode: 'user' } : false,
  })
}
