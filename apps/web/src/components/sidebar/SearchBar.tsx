interface Props {
  value: string
  onChange: (val: string) => void
  onNewChat?: () => void
}

export function SearchBar({ value, onChange, onNewChat }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Поиск чатов..."
          className="w-full pl-9 pr-4 py-2 bg-black/6 dark:bg-white/8
            rounded-full text-sm text-gray-900 dark:text-gray-100
            placeholder-gray-400 focus:outline-none focus:ring-2
            focus:ring-primary-400/50 transition"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2
              text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {onNewChat && (
        <button
          onClick={onNewChat}
          title="Новый чат"
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full
            text-gray-500 dark:text-gray-400
            hover:bg-black/8 dark:hover:bg-white/10
            hover:text-primary-500 dark:hover:text-primary-400
            transition-colors active:scale-90"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
    </div>
  )
}
