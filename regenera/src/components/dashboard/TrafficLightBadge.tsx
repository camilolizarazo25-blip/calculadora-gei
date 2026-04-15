import type { TrafficLight } from '@/lib/dashboard'

interface Props {
  light: TrafficLight
  label: string
  size?: 'sm' | 'md'
}

export function TrafficLightBadge({ light, label, size = 'md' }: Props) {
  const config = {
    red:    { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
    yellow: { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
    green:  { dot: 'bg-brand-500',  text: 'text-brand-700',  bg: 'bg-brand-50 border-brand-200' },
  }[light]

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium ${textSize} ${config.bg} ${config.text}`}>
      <span className={`${dotSize} rounded-full flex-shrink-0 ${config.dot} ${light !== 'green' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}
