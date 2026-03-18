export function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center
      bg-chat dark:bg-chat-dark text-center select-none">
      <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900
        flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300">ZLP Messenger</h2>
      <p className="text-sm text-gray-400 mt-2 max-w-xs">
        Select a conversation or start a new one
      </p>
    </div>
  )
}
