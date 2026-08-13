import { useState, useMemo, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { Clock, ListChecks, TrendingUp, TrendingDown, Award, Target, CheckCircle2 } from 'lucide-react'
import { useTimeLogs } from '../hooks/useTimeLogs'
import { useCategories } from '../hooks/useCategories'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

function fmtHours(minutes) {
  const h = minutes / 60
  return h < 1 ? `${Math.round(minutes)}m` : `${h.toFixed(1)}h`
}

export default function Reports() {
  const { user } = useAuth()
  const [range, setRange] = useState(7)
  const { logs, loading } = useTimeLogs(range)
  const { categories } = useCategories()
  const [taskCounts, setTaskCounts] = useState({ total: 0, done: 0 })
  const [prevPeriodMinutes, setPrevPeriodMinutes] = useState(0)

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  )

  // Completion rate: all tasks (not just logged ones) in range vs done
  useEffect(() => {
    if (!user) return
    const since = new Date()
    since.setDate(since.getDate() - range)
    const sinceStr = since.toISOString().slice(0, 10)
    supabase
      .from('tasks')
      .select('status', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('target_date', sinceStr)
      .then(({ data }) => {
        const total = data?.length || 0
        const done = (data || []).filter((t) => t.status === 'done').length
        setTaskCounts({ total, done })
      })
  }, [user, range])

  // Previous period for trend comparison
  useEffect(() => {
    if (!user) return
    const prevEnd = new Date()
    prevEnd.setDate(prevEnd.getDate() - range)
    const prevStart = new Date()
    prevStart.setDate(prevStart.getDate() - range * 2)
    supabase
      .from('time_logs')
      .select('actual_duration_minutes')
      .eq('user_id', user.id)
      .gte('actual_end', prevStart.toISOString())
      .lt('actual_end', prevEnd.toISOString())
      .then(({ data }) => {
        setPrevPeriodMinutes((data || []).reduce((s, l) => s + (l.actual_duration_minutes || 0), 0))
      })
  }, [user, range])

  const pieData = useMemo(() => {
    const totals = {}
    for (const log of logs) {
      const catId = log.tasks?.category_id
      const cat = categoryById[catId]
      const name = cat?.name || 'Uncategorized'
      totals[name] = (totals[name] || 0) + (log.actual_duration_minutes || 0)
    }
    return Object.entries(totals)
      .map(([name, minutes]) => ({
        name,
        minutes,
        color: categories.find((c) => c.name === name)?.color_hex || '#94a3b8',
      }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [logs, categoryById, categories])

  const barData = useMemo(() => {
    const byDay = {}
    for (const log of logs) {
      const day = (log.actual_end || '').slice(0, 10)
      if (!day) continue
      if (!byDay[day]) byDay[day] = { day }
      const catId = log.tasks?.category_id
      const name = categoryById[catId]?.name || 'Uncategorized'
      byDay[day][name] = (byDay[day][name] || 0) + (log.actual_duration_minutes || 0)
    }
    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day))
  }, [logs, categoryById])

  // Normalize priority to lowercase so casing differences never silently drop a bucket
  const priorityBreakdown = useMemo(() => {
    const totals = { high: 0, medium: 0, low: 0 }
    for (const log of logs) {
      const raw = (log.tasks?.priority || 'medium').toString().toLowerCase().trim()
      const p = totals.hasOwnProperty(raw) ? raw : 'medium'
      totals[p] += log.actual_duration_minutes || 0
    }
    const total = totals.high + totals.medium + totals.low || 1
    return [
      { label: 'High priority', minutes: totals.high, pct: Math.round((totals.high / total) * 100), color: '#ef4444' },
      { label: 'Medium priority', minutes: totals.medium, pct: Math.round((totals.medium / total) * 100), color: '#f59e0b' },
      { label: 'Low priority', minutes: totals.low, pct: Math.round((totals.low / total) * 100), color: '#6b7280' },
    ]
  }, [logs])

  const totalMinutes = logs.reduce((sum, l) => sum + (l.actual_duration_minutes || 0), 0)
  const totalTasks = logs.length
  const daysWithActivity = new Set(logs.map((l) => (l.actual_end || '').slice(0, 10))).size
  const avgMinutesPerDay = daysWithActivity ? totalMinutes / daysWithActivity : 0
  const topCategory = pieData[0]?.name || '—'
  const completionRate = taskCounts.total ? Math.round((taskCounts.done / taskCounts.total) * 100) : 0
  const trendPct = prevPeriodMinutes ? Math.round(((totalMinutes - prevPeriodMinutes) / prevPeriodMinutes) * 100) : null

  const categoryNames = useMemo(() => [...new Set(categories.map((c) => c.name))], [categories])

  const chartTooltipStyle = { borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-100">Performance Summary</p>
            <h1 className="mt-1 text-2xl font-semibold">Productivity Report</h1>
            <p className="mt-1 text-sm text-brand-100">
              Last {range} days · {totalTasks} task{totalTasks !== 1 ? 's' : ''} logged
              {trendPct !== null && (
                <span className="ml-2 inline-flex items-center gap-1">
                  {trendPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {Math.abs(trendPct)}% vs previous period
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition ' +
                  (range === r.value ? 'bg-white text-brand-700' : 'bg-white/15 text-white hover:bg-white/25')
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard icon={Clock} label="Hours tracked" value={fmtHours(totalMinutes)} accent="#4f46e5" />
        <StatCard icon={ListChecks} label="Tasks completed" value={totalTasks} accent="#22c55e" />
        <StatCard icon={CheckCircle2} label="Completion rate" value={completionRate + '%'} accent="#06b6d4" />
        <StatCard icon={TrendingUp} label="Avg / active day" value={fmtHours(avgMinutesPerDay)} accent="#f59e0b" />
        <StatCard icon={Award} label="Top category" value={topCategory} isText accent="#a855f7" />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No completed tasks yet in this range. Finish a few tasks and check back.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Time Allocation by Category</h2>
                <span className="text-xs text-[var(--text-secondary)]">{fmtHours(totalMinutes)} total</span>
              </div>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={220} className="sm:w-1/2">
                  <PieChart>
                    <Pie data={pieData} dataKey="minutes" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [fmtHours(value), '']} contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2 sm:w-1/2">
                  {pieData.map((entry, i) => {
                    const pct = Math.round((entry.minutes / totalMinutes) * 100)
                    return (
                      <div key={i}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}
                          </span>
                          <span className="text-[var(--text-secondary)]">{fmtHours(entry.minutes)} · {pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                          <div className="h-full rounded-full" style={{ width: pct + '%', backgroundColor: entry.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Target size={16} className="text-brand-600" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Effort by Priority</h2>
              </div>
              <div className="space-y-4">
                {priorityBreakdown.map((p) => (
                  <div key={p.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text-primary)]">{p.label}</span>
                      <span className="text-[var(--text-secondary)]">{fmtHours(p.minutes)} · {p.pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div className="h-full rounded-full" style={{ width: p.pct + '%', backgroundColor: p.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Daily Time Breakdown</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => (v / 60).toFixed(0) + 'h'} />
                <Tooltip formatter={(value) => [fmtHours(value), '']} contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {categoryNames.map((name) => (
                  <Bar key={name} dataKey={name} stackId="a" fill={categories.find((c) => c.name === name)?.color_hex || '#94a3b8'} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent, isText }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: accent + '1a' }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <p className={isText ? 'truncate text-base font-semibold text-[var(--text-primary)]' : 'text-xl font-semibold text-[var(--text-primary)]'}>
        {value}
      </p>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
    </div>
  )
}
