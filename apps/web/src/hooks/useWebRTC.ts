import { useRef, useCallback } from 'react'
import { useCallStore } from '@/store/call'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

type SendFn = (type: string, payload: unknown) => void

export function useWebRTC(send: SendFn) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const updateActive = useCallStore((s) => s.updateActive)

  const createPC = useCallback((callId: string, targetId: string) => {
    if (pcRef.current) {
      pcRef.current.close()
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc

    // Send ICE candidates to remote peer
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send('webrtc_ice', {
          target_user_id: targetId,
          call_id: callId,
          data: e.candidate,
        })
      }
    }

    // Receive remote stream
    pc.ontrack = (e) => {
      const remoteStream = e.streams[0]
      if (remoteStream) {
        updateActive({ remoteStream, status: 'active', startedAt: Date.now() })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        updateActive({ status: 'ended' })
      }
    }

    return pc
  }, [send, updateActive])

  // ── Caller: initiate ──────────────────────────────────────

  const startCall = useCallback(async (
    callId: string,
    targetId: string,
    type: 'voice' | 'video',
  ) => {
    const stream = await getLocalStream(type)
    updateActive({ localStream: stream })

    const pc = createPC(callId, targetId)
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    send('webrtc_offer', { target_user_id: targetId, call_id: callId, data: offer })
    return stream
  }, [createPC, send, updateActive])

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
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    send('webrtc_answer', { target_user_id: callerId, call_id: callId, data: answer })
    return stream
  }, [createPC, send, updateActive])

  // ── Handle answer from callee ─────────────────────────────

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer))
  }, [])

  // ── Handle ICE candidate ──────────────────────────────────

  const handleICE = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
    } catch { /* ignore */ }
  }, [])

  // ── Hang up ───────────────────────────────────────────────

  const hangup = useCallback(() => {
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

  // ── Send offer using existing stream (for caller after call_accepted) ──

  const sendOffer = useCallback(async (
    callId: string,
    targetId: string,
    stream: MediaStream,
  ) => {
    const pc = createPC(callId, targetId)
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send('webrtc_offer', { target_user_id: targetId, call_id: callId, data: offer })
  }, [createPC, send])

  return { startCall, answerCall, handleAnswer, handleICE, hangup, toggleMute, toggleVideo, sendOffer }
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
