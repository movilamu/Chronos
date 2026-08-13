import { useState } from 'react'
import { CalendarCheck2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const steps = ['College', 'Sleep', 'Study', 'Meals', 'Review']

export default function Onboarding() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    college_start: '09:00',
    college_end: '16:00',
    college_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    sleep_start: '23:00',
    sleep_end: '07:00',
    ideal_study_start: '19:00',
    ideal_study_end: '21:30',
    meals: [
      { label: 'Breakfast', start: '07:30', end: '08:00' },
      { label: 'Lunch', start: '13:00', end: '13:30' },
      { label: 'Dinner', start: '20:30', end: '21:00' },
    ],
  })

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const toggleDay = (day) => {
    setForm((f) => ({
      ...f,
      college_days: f.college_days.includes(day)
        ? f.college_days.filter((d) => d !== day)
        : [...f.college_days, day],
    }))
  }

  const updateMeal = (idx, key, value) => {
    setForm((f) => {
      const meals = [...f.meals]
      meals[idx] = { ...meals[idx], [key]: value }
      return { ...f, meals }
    })
  }

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const finish = async () => {
    setSaving(true)
    setError(null)
    try {
      const { error: settingsError } = await supabase
        .from('user_settings')
        .update({
          college_start: form.college_start,
          college_end: form.college_end,
          college_days: form.college_days,
          sleep_start: form.sleep_start,
          sleep_end: form.sleep_end,
          ideal_study_start: form.ideal_study_start,
          ideal_study_end: form.ideal_study_end,
          meal_times: form.meals,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (settingsError) throw settingsError

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      if (profileError) throw profileError

      window.location.reload()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <CalendarCheck2 size={20} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">Let's set up your day</span>
        </div>

        <div className="mb-8 flex gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? 'bg-brand-600' : 'bg-[var(--bg-tertiary)]'
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">
            {steps[step]}
          </h2>

          {step === 0 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                We'll treat this as a fixed block — nothing else gets scheduled here.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input type="time" value={form.college_start}
                    onChange={(e) => update('college_start', e.target.value)}
                    className={inputCls} />
                </Field>
                <Field label="Ends">
                  <input type="time" value={form.college_end}
                    onChange={(e) => update('college_end', e.target.value)}
                    className={inputCls} />
                </Field>
              </div>
              <Field label="Days">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        form.college_days.includes(d)
                          ? 'bg-brand-600 text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                We'll never schedule tasks during your sleep window.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bedtime">
                  <input type="time" value={form.sleep_start}
                    onChange={(e) => update('sleep_start', e.target.value)}
                    className={inputCls} />
                </Field>
                <Field label="Wake up">
                  <input type="time" value={form.sleep_end}
                    onChange={(e) => update('sleep_end', e.target.value)}
                    className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Your ideal focus window — deep work and upskilling get prioritized here. Chores
                and casual tasks will be kept out of this block.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input type="time" value={form.ideal_study_start}
                    onChange={(e) => update('ideal_study_start', e.target.value)}
                    className={inputCls} />
                </Field>
                <Field label="Ends">
                  <input type="time" value={form.ideal_study_end}
                    onChange={(e) => update('ideal_study_end', e.target.value)}
                    className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Meal times also become fixed blocks in your day.
              </p>
              {form.meals.map((meal, idx) => (
                <div key={meal.label} className="grid grid-cols-3 items-end gap-3">
                  <Field label={meal.label}>
                    <div className="flex h-10 items-center text-sm text-[var(--text-secondary)]">
                      {meal.label}
                    </div>
                  </Field>
                  <Field label="Starts">
                    <input type="time" value={meal.start}
                      onChange={(e) => updateMeal(idx, 'start', e.target.value)}
                      className={inputCls} />
                  </Field>
                  <Field label="Ends">
                    <input type="time" value={meal.end}
                      onChange={(e) => updateMeal(idx, 'end', e.target.value)}
                      className={inputCls} />
                  </Field>
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="mt-4 space-y-3 text-sm">
              <ReviewRow label="College" value={`${form.college_start} - ${form.college_end} (${form.college_days.join(', ')})`} />
              <ReviewRow label="Sleep" value={`${form.sleep_start} - ${form.sleep_end}`} />
              <ReviewRow label="Study window" value={`${form.ideal_study_start} - ${form.ideal_study_end}`} />
              {form.meals.map((m) => (
                <ReviewRow key={m.label} label={m.label} value={`${m.start} - ${m.end}`} />
              ))}
              <p className="pt-2 text-xs text-[var(--text-secondary)]">
                You can change all of this later in Settings.
              </p>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 0}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-0"
            >
              <ChevronLeft size={16} /> Back
            </button>

            {step < steps.length - 1 ? (
              <button
                onClick={next}
                className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving...' : 'Start planning'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
    </div>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  )
}
