export function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center
      chat-bg text-center select-none animate-fadeIn">

      {/* Floating icon */}
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-full
          bg-white/60 dark:bg-white/5
          backdrop-blur-sm
          border border-white/80 dark:border-white/10
          shadow-xl
          flex items-center justify-center
          animate-float">
          <svg className="w-14 h-14 text-primary-500" fill="none"
            viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863
                9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3
                12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full
          bg-primary-500/10 dark:bg-primary-500/5
          blur-xl -z-10 scale-150" />
      </div>

      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200
        tracking-tight">
        ZLP Messenger
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs leading-relaxed">
        Выберите чат или начните новый
      </p>

      {/* Decorative dots */}
      <div className="flex gap-1.5 mt-6 opacity-30">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary-500"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  )
}
