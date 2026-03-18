export function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
      <span className="text-xs text-gray-500 dark:text-gray-400 bg-chat dark:bg-chat-dark px-2">
        {date}
      </span>
      <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
    </div>
  )
}
