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

  // ── Handle incoming offer (new participant joined) ──────────
  const handleOffer = useCallback(async (
    from: string,
    fromName: string,
    offer: RTCSessionDescriptionInit,
    localStream: MediaStream,
  ) => {
    addRemoteParticipant(from, fromName)
    const pc = createPC(from)
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))

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
    pcsRef.current.forEach((pc) => pc.close())
    pcsRef.current.clear()
    pendingICE.current.clear()
    callIdRef.current = ''
    leaveCall()
  }, [leaveCall])

  return { joinAndOffer, handleOffer, handleAnswer, handleIce, participantLeft, leave, callIdRef }
}
