import { useRef, useCallback } from 'react'
import { useGroupCallStore } from '@/store/groupCall'

function getIceServers(): RTCIceServer[] {
  const host = window.location.hostname
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: `turn:${host}:3478`, username: 'zlp', credential: 'zlp_turn_secret' },
  ]
}

type SendFn = (type: string, payload: unknown) => void

export function useGroupWebRTC(send: SendFn) {
  // Map userId → RTCPeerConnection
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  // Buffer ICE candidates that arrive before remote description is set
  const pendingICE = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())

  const {
    addRemoteParticipant,
    removeRemoteParticipant,
    setParticipantStream,
    leaveCall,
  } = useGroupCallStore.getState()

  const callIdRef = useRef<string>('')
  const screenStreamRef = useRef<MediaStream | null>(null)

  // ── Create a peer connection for one remote participant ─────
  const createPC = useCallback((userId: string): RTCPeerConnection => {
    const existing = pcsRef.current.get(userId)
    if (existing) {
      existing.close()
    }
    const pc = new RTCPeerConnection({ iceServers: getIceServers() })
    pcsRef.current.set(userId, pc)
    pendingICE.current.set(userId, [])

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send('group_webrtc_ice', {
          target_user_id: userId,
          call_id: callIdRef.current,
          data: e.candidate,
        })
      }
    }

    pc.ontrack = (e) => {
      const stream = e.streams[0]
      if (stream) {
        setParticipantStream(userId, stream)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pcsRef.current.delete(userId)
      }
    }

    // Renegotiation — fires when tracks are added mid-call (e.g. screen sharing)
    pc.onnegotiationneeded = async () => {
      if (pc !== pcsRef.current.get(userId)) return
      if (pc.signalingState !== 'stable') return
      try {
        const offer = await pc.createOffer()
        if (pc.signalingState !== 'stable') return
        await pc.setLocalDescription(offer)
        send('group_webrtc_offer', {
          target_user_id: userId,
          call_id: callIdRef.current,
          data: offer,
        })
      } catch { /* ignore */ }
    }

    return pc
  }, [send, setParticipantStream])

  // ── Join: send offers to all existing participants ──────────
  const joinAndOffer = useCallback(async (
    callId: string,
    existingParticipants: { userId: string; userName: string }[],
    localStream: MediaStream,
  ) => {
    callIdRef.current = callId
    for (const p of existingParticipants) {
      addRemoteParticipant(p.userId, p.userName)
      const pc = createPC(p.userId)
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send('group_webrtc_offer', {
        target_user_id: p.userId,
        call_id: callId,
        data: offer,
      })
    }
  }, [send, createPC, addRemoteParticipant])

  // ── Handle incoming offer (new participant or renegotiation) ─
  const handleOffer = useCallback(async (
    from: string,
    fromName: string,
    offer: RTCSessionDescriptionInit,
    localStream: MediaStream,
  ) => {
    const existingPC = pcsRef.current.get(from)

    // Renegotiation from an existing participant (e.g. they started screen sharing)
    if (existingPC && existingPC.signalingState !== 'closed') {
      await existingPC.setRemoteDescription(new RTCSessionDescription(offer))
      const buffered = pendingICE.current.get(from) ?? []
      for (const c of buffered) {
        await existingPC.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
      }
      pendingICE.current.set(from, [])
      const answer = await existingPC.createAnswer()
      await existingPC.setLocalDescription(answer)
      send('group_webrtc_answer', {
        target_user_id: from,
        call_id: callIdRef.current,
        data: answer,
      })
      return
    }

    // New participant joining
    addRemoteParticipant(from, fromName)
    const pc = createPC(from)
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))

    // Add screen track BEFORE creating the answer so it's included in the initial SDP —
    // no second renegotiation needed; the new participant gets video immediately.
    if (screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0]
      if (screenTrack && screenTrack.readyState === 'live') {
        pc.addTrack(screenTrack, localStream)
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    // Apply any buffered ICE candidates
    const buffered = pendingICE.current.get(from) ?? []
    for (const c of buffered) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    }
    pendingICE.current.set(from, [])

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    send('group_webrtc_answer', {
      target_user_id: from,
      call_id: callIdRef.current,
      data: answer,
    })
  }, [send, createPC, addRemoteParticipant])

  // ── Handle answer from a participant ───────────────────────
  const handleAnswer = useCallback(async (
    from: string,
    answer: RTCSessionDescriptionInit,
  ) => {
    const pc = pcsRef.current.get(from)
    if (!pc) return
    await pc.setRemoteDescription(new RTCSessionDescription(answer))
    // Apply buffered ICE
    const buffered = pendingICE.current.get(from) ?? []
    for (const c of buffered) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    }
    pendingICE.current.set(from, [])
  }, [])

  // ── Handle ICE candidate ────────────────────────────────────
  const handleIce = useCallback(async (
    from: string,
    candidate: RTCIceCandidateInit,
  ) => {
    const pc = pcsRef.current.get(from)
    if (!pc || !pc.remoteDescription) {
      // Buffer until remote description is set
      const buf = pendingICE.current.get(from) ?? []
      buf.push(candidate)
      pendingICE.current.set(from, buf)
      return
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
  }, [])

  // ── Participant left — close their PC ──────────────────────
  const participantLeft = useCallback((userId: string) => {
    const pc = pcsRef.current.get(userId)
    if (pc) {
      pc.close()
      pcsRef.current.delete(userId)
    }
    pendingICE.current.delete(userId)
    removeRemoteParticipant(userId)
  }, [removeRemoteParticipant])

  // ── Leave call — close all PCs ─────────────────────────────
  const leave = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    pcsRef.current.forEach((pc) => pc.close())
    pcsRef.current.clear()
    pendingICE.current.clear()
    callIdRef.current = ''
    leaveCall()
  }, [leaveCall])

  // ── Stop screen sharing ─────────────────────────────────────
  const stopGroupScreenShare = useCallback(async () => {
    const active = useGroupCallStore.getState().active
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null

    // Restore camera video track (or remove if voice-only)
    const cameraTrack = active?.localStream?.getVideoTracks()[0]
    for (const [, pc] of pcsRef.current) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack).catch(() => {})
      } else if (sender && !cameraTrack) {
        pc.removeTrack(sender)
      }
    }
    useGroupCallStore.getState().setScreenSharing(false)
    useGroupCallStore.getState().setGroupScreenStream(null)
    if (active) {
      send('group_screen_share', { call_id: callIdRef.current, chat_id: active.chatId, is_sharing: false })
    }
  }, [send])

  // ── Toggle screen sharing ───────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    const active = useGroupCallStore.getState().active
    if (!active) return

    if (active.isScreenSharing) {
      await stopGroupScreenShare()
      return
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      screenStreamRef.current = screenStream
      const screenTrack = screenStream.getVideoTracks()[0]

      for (const [, pc] of pcsRef.current) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(screenTrack).catch(() => {})
        } else {
          pc.addTrack(screenTrack, active.localStream ?? screenStream)
        }
      }

      screenTrack.onended = () => { stopGroupScreenShare() }
      useGroupCallStore.getState().setScreenSharing(true)
      useGroupCallStore.getState().setGroupScreenStream(screenStream)
      send('group_screen_share', { call_id: callIdRef.current, chat_id: active.chatId, is_sharing: true })
    } catch {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
    }
  }, [stopGroupScreenShare, send])

  return { joinAndOffer, handleOffer, handleAnswer, handleIce, participantLeft, leave, callIdRef, toggleScreenShare }
}
