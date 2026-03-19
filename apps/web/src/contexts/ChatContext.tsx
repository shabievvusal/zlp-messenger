import { createContext, useContext, useState, useCallback } from 'react'
import type { Message, MediaGalleryItem } from '@/types'

interface ChatContextValue {
  replyTo: Message | null
  setReplyTo: (msg: Message | null) => void
  editMsg: Message | null
  setEditMsg: (msg: Message | null) => void
  forwardMsg: Message | null
  setForwardMsg: (msg: Message | null) => void
  mediaViewer: { url: string; type: 'photo' | 'video' } | null
  openMedia: (url: string, type: 'photo' | 'video') => void
  closeMedia: () => void
  // Gallery view (multiple photos)
  mediaGallery: MediaGalleryItem[] | null
  galleryIndex: number
  openGallery: (items: MediaGalleryItem[], startIndex: number) => void
  closeGallery: () => void
  nextGalleryImage: () => void
  prevGalleryImage: () => void
  clearInput: () => void
  onClearInput: (fn: () => void) => void
  // Message selection (like Telegram checkboxes)
  selectedMsgIds: string[]
  isSelecting: boolean
  enterSelectMode: (id: string) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  // Highlight / jump-to message (from search)
  highlightMsgId: string | null
  setHighlightMsgId: (id: string | null) => void
}

const ChatContext = createContext<ChatContextValue>({} as ChatContextValue)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [replyTo, setReplyToState] = useState<Message | null>(null)
  const [editMsg, setEditMsgState] = useState<Message | null>(null)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'photo' | 'video' } | null>(null)
  const [mediaGallery, setMediaGallery] = useState<MediaGalleryItem[] | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [clearFn, setClearFn] = useState<(() => void) | null>(null)
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([])
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null)

  const setReplyTo = useCallback((msg: Message | null) => {
    setReplyToState(msg)
    setEditMsgState(null)
  }, [])

  const setEditMsg = useCallback((msg: Message | null) => {
    setEditMsgState(msg)
    setReplyToState(null)
  }, [])

  const openMedia = useCallback((url: string, type: 'photo' | 'video') => {
    setMediaViewer({ url, type })
  }, [])

  const closeMedia = useCallback(() => setMediaViewer(null), [])

  const openGallery = useCallback((items: MediaGalleryItem[], startIndex: number) => {
    setMediaGallery(items)
    setGalleryIndex(startIndex)
  }, [])

  const closeGallery = useCallback(() => {
    setMediaGallery(null)
    setGalleryIndex(0)
  }, [])

  const nextGalleryImage = useCallback(() => {
    setGalleryIndex((prev) => (mediaGallery ? (prev + 1) % mediaGallery.length : 0))
  }, [mediaGallery])

  const prevGalleryImage = useCallback(() => {
    setGalleryIndex((prev) => (mediaGallery ? (prev - 1 + mediaGallery.length) % mediaGallery.length : 0))
  }, [mediaGallery])

  const clearInput = useCallback(() => clearFn?.(), [clearFn])
  const onClearInput = useCallback((fn: () => void) => setClearFn(() => fn), [])

  const enterSelectMode = useCallback((id: string) => {
    setSelectedMsgIds([id])
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedMsgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const clearSelection = useCallback(() => setSelectedMsgIds([]), [])

  const isSelecting = selectedMsgIds.length > 0

  return (
    <ChatContext.Provider value={{
      replyTo, setReplyTo,
      editMsg, setEditMsg,
      forwardMsg, setForwardMsg,
      mediaViewer, openMedia, closeMedia,
      mediaGallery, galleryIndex, openGallery, closeGallery, nextGalleryImage, prevGalleryImage,
      clearInput, onClearInput,
      selectedMsgIds, isSelecting,
      enterSelectMode, toggleSelect, clearSelection,
      highlightMsgId, setHighlightMsgId,
    }}>
      {children}
    </ChatContext.Provider>
  )
}
}

export const useChatCtx = () => useContext(ChatContext)
