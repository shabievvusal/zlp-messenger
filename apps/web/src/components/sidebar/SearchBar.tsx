interface Props {
  value: string
  onChange: (val: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="px-3 py-2">
      <div className="relative">
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
          className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700
            rounded-full text-sm text-gray-900 dark:text-gray-100
            placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 transition"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
