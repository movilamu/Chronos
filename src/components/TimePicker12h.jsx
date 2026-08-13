import { useMemo } from 'react'

// value/onChange work in 24h "HH:MM" internally (so it stores/compares cleanly),
// but the UI is entirely 12-hour with AM/PM buttons beside it.
export default function TimePicker12h({ value, onChange, className = '' }) {
  const { hour12, minute, period } = useMemo(() => parse24(value), [value])

  const setPart = (h12, m, p) => {
    onChange(to24(h12, m, p))
  }

  return (
    <div className={'flex items-center gap-1.5 ' + className}>
      <select
        value={hour12}
        onChange={(e) => setPart(Number(e.target.value), minute, period)}
        className={selectCls}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-[var(--text-secondary)]">:</span>
      <select
        value={minute}
        onChange={(e) => setPart(hour12, Number(e.target.value), period)}
        className={selectCls}
      >
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
      <div className="ml-1 flex overflow-hidden rounded-lg border border-[var(--border-color)]">
        <button
          type="button"
          onClick={() => setPart(hour12, minute, 'AM')}
          className={'px-2 py-1.5 text-xs font-medium transition ' + (period === 'AM' ? 'bg-brand-600 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]')}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => setPart(hour12, minute, 'PM')}
          className={'px-2 py-1.5 text-xs font-medium transition ' + (period === 'PM' ? 'bg-brand-600 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]')}
        >
          PM
        </button>
      </div>
    </div>
  )
}

function parse24(value) {
  if (!value) return { hour12: 9, minute: 0, period: 'AM' }
  const [hStr, mStr] = value.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10) || 0
  const period = h >= 12 ? 'PM' : 'AM'
  let hour12 = h % 12
  if (hour12 === 0) hour12 = 12
  return { hour12, minute: m, period }
}

function to24(hour12, minute, period) {
  let h = hour12 % 12
  if (period === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const selectCls =
  'rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500'
