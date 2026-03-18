interface Props {
  name: string
  url?: string | null
  size?: number
}

const COLORS = [
  'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400',
  'bg-teal-400', 'bg-blue-400', 'bg-indigo-400', 'bg-purple-400',
]

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function Avatar({ name, url, size = 40 }: Props) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover flex-shrink-0"
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`rounded-full flex items-center justify-center flex-shrink-0
        text-white font-semibold ${colorFor(name)}`}
    >
      {initials}
    </div>
  )
}
