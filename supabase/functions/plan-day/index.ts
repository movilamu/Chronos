// supabase/functions/plan-day/index.ts
// Deploy: supabase functions deploy plan-day
//
// Input: { target_date: "2026-08-12" }
//
// Handles: multi-block College/Sleep/Focus windows, locked-time tasks (never
// moved by AI), focus-window eligibility (category flag + per-task override +
// AI-asked classification questions for ambiguous tasks), and overflow
// detection (tasks that don't fit before bedtime become conflicts suggesting
// tomorrow instead of being silently crammed in).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) throw new Error('Invalid session')

    const { target_date } = await req.json()
    if (!target_date) throw new Error('target_date is required')

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const [{ data: settings }, { data: categories }, { data: tasks }] = await Promise.all([
      db.from('user_settings').select('*').eq('user_id', user.id).single(),
      db.from('categories').select('*').eq('user_id', user.id),
      db.from('tasks').select('*').eq('user_id', user.id).eq('target_date', target_date)
        .in('status', ['pending', 'in_progress', 'waiting_for']),
    ])

    if (!settings) throw new Error('User settings not found — complete onboarding first')

    const now = new Date()
    const isToday = target_date === now.toISOString().slice(0, 10)
    const planningStart = isToday ? now.toTimeString().slice(0, 5) : '00:00'
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(target_date + 'T12:00:00').getDay()]

    const categoryMap = Object.fromEntries((categories || []).map((c) => [c.id, c]))

    // in-progress: locked because they're already happening
    // locked_time tasks that already have a scheduled_start: locked because the user pinned them
    const alreadyLocked = (tasks || []).filter(
      (t) => t.status === 'in_progress' || (t.locked_time && t.scheduled_start)
    )
    // plannable = everything else, EXCLUDING already-locked tasks from being re-time'd
    const plannableTasks = (tasks || []).filter((t) => !alreadyLocked.includes(t))

    if (plannableTasks.length === 0) {
      return json({ scheduled: [], conflicts: [], message: 'Nothing to plan' })
    }

    const fixedBlocks = buildFixedBlocks(settings, alreadyLocked, weekday)
    const focusWindows = resolveBlocks(settings.focus_blocks, settings.ideal_study_start, settings.ideal_study_end)

    // Tasks needing a focus-classification question (ambiguous, not in a focus
    // category, no prior override) get asked via a conflict instead of guessed.
    const needsClassification = plannableTasks.filter((t) => {
      const cat = categoryMap[t.category_id]
      if (cat?.is_focus_category) return false // auto-yes
      if (t.force_focus === true || t.force_focus === false) return false // already answered
      return true // AI will judge; if AI itself is unsure, it'll flag it too
    })

    const prompt = buildPrompt({
      settings,
      fixedBlocks,
      focusWindows,
      tasks: plannableTasks.map((t) => {
        const cat = categoryMap[t.category_id]
        const isFocus = cat?.is_focus_category ? true : (t.force_focus === true ? true : (t.force_focus === false ? false : null))
        return {
          id: t.id,
          title: t.title,
          duration_minutes: t.duration_minutes,
          priority: t.priority,
          category: cat?.name || 'Uncategorized',
          category_window: categoryWindowText(cat),
          preferred_time: t.preferred_time ? t.preferred_time.slice(0, 5) : null,
          locked_time: !!t.locked_time,
          is_focus: isFocus, // true / false / null(=ask)
        }
      }),
      planningStart,
      dayEnd: resolveDayEnd(settings, weekday),
      bufferMinutes: settings.buffer_minutes ?? 10,
      targetDate: target_date,
      hasFocusTasks: plannableTasks.some((t) => {
        const cat = categoryMap[t.category_id]
        return cat?.is_focus_category || t.force_focus === true
      }),
    })

    const aiResult = await callGroq(prompt)

    const scheduled = []
    for (const item of aiResult.scheduled || []) {
      const task = plannableTasks.find((t) => t.id === item.task_id)
      if (!task) continue
      const startISO = `${target_date}T${item.start}:00`
      const endISO = `${target_date}T${item.end}:00`
      await db.from('tasks').update({ scheduled_start: startISO, scheduled_end: endISO }).eq('id', task.id)
      scheduled.push({ task_id: task.id, start: item.start, end: item.end })
    }

    const conflicts = []
    for (const c of aiResult.conflicts || []) {
      const taskIds = (c.task_ids || []).filter((id) => plannableTasks.some((t) => t.id === id))
      if (taskIds.length === 0) continue
      const { data: inserted } = await db
        .from('schedule_conflicts')
        .insert({
          user_id: user.id,
          task_ids: taskIds,
          conflict_type: c.type || 'ambiguous_category',
          ai_suggestion: c.suggestion || null,
          status: 'pending',
        })
        .select()
        .single()
      conflicts.push(inserted)
    }

    // Focus-classification questions from the AI (task looked study/work-related
    // but isn't in a focus category and has no override yet)
    for (const q of aiResult.focus_questions || []) {
      const task = plannableTasks.find((t) => t.id === q.task_id)
      if (!task) continue
      const { data: inserted } = await db
        .from('schedule_conflicts')
        .insert({
          user_id: user.id,
          task_ids: [task.id],
          conflict_type: 'focus_classification',
          ai_suggestion: q.question || `Is "${task.title}" study/work-related deep-focus work?`,
          status: 'pending',
        })
        .select()
        .single()
      conflicts.push(inserted)
    }

    return json({ scheduled, conflicts })
  } catch (err) {
    console.error(err)
    return json({ error: err.message }, 400)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Multi-block resolver: use the jsonb array if present, else fall back to the
// legacy singular start/end fields (for users who haven't re-saved settings).
function resolveBlocks(blocksJson, fallbackStart, fallbackEnd) {
  if (Array.isArray(blocksJson) && blocksJson.length > 0) return blocksJson
  if (fallbackStart && fallbackEnd) return [{ start: fallbackStart, end: fallbackEnd }]
  return []
}

function resolveDayEnd(settings, weekday) {
  const sleepBlocks = resolveBlocks(settings.sleep_blocks, settings.sleep_start, settings.sleep_end)
  // day "ends" at the start of the first sleep block that applies today
  return sleepBlocks[0]?.start || settings.sleep_start || '23:00'
}

function buildFixedBlocks(settings, lockedTasks, weekday) {
  const blocks = []

  const collegeBlocks = resolveBlocks(settings.college_blocks, settings.college_start, settings.college_end)
  for (const b of collegeBlocks) {
    if (b.days && b.days.length > 0 && !b.days.includes(weekday)) continue
    blocks.push({ label: 'College/Work', start: b.start, end: b.end })
  }

  for (const meal of settings.meal_times || []) {
    blocks.push({ label: meal.label, start: meal.start, end: meal.end })
  }

  for (const t of lockedTasks) {
    if (t.scheduled_start && t.scheduled_end) {
      blocks.push({
        label: `Locked: ${t.title}`,
        start: t.scheduled_start.slice(11, 16),
        end: t.scheduled_end.slice(11, 16),
      })
    }
  }

  return blocks
}

function categoryWindowText(cat) {
  if (!cat) return 'no restriction'
  const parts = []
  if (cat.allowed_start && cat.allowed_end) parts.push(`only allowed ${cat.allowed_start}-${cat.allowed_end}`)
  if (cat.blocked_start && cat.blocked_end) parts.push(`never during ${cat.blocked_start}-${cat.blocked_end}`)
  return parts.length ? parts.join('; ') : 'no restriction'
}

function buildPrompt({ settings, fixedBlocks, focusWindows, tasks, planningStart, dayEnd, bufferMinutes, targetDate, hasFocusTasks }) {
  return `You are a scheduling assistant. Plan the given tasks into today's remaining free time.

DATE: ${targetDate}
PLANNING WINDOW: ${planningStart} to ${dayEnd} (do not schedule outside this window; ${dayEnd} is bedtime)
IDEAL FOCUS WINDOW(S): ${focusWindows.length ? focusWindows.map((w) => `${w.start}-${w.end}`).join(', ') : '(none set)'}
FOCUS WINDOW RULE: ${hasFocusTasks
    ? 'There ARE focus/deep-work tasks today (is_focus=true). Reserve the focus window(s) for them first. Only place non-focus tasks there if there is truly no other free time left.'
    : 'No confirmed focus tasks today. The focus window is free to use normally for any task.'}
BUFFER BETWEEN TASKS: ${bufferMinutes} minutes minimum

FIXED BLOCKS (College/Work, meals, locked tasks — NEVER schedule anything on top of these, no exceptions):
${fixedBlocks.map((b) => `- ${b.label}: ${b.start}-${b.end}`).join('\n') || '(none)'}

TASKS TO SCHEDULE:
${tasks.map((t) => {
    const focusNote = t.is_focus === true ? 'FOCUS TASK - use focus window'
      : t.is_focus === false ? 'not focus-eligible - keep OUT of focus window'
      : 'UNKNOWN if this is study/work-related - judge from the title. If genuinely ambiguous, schedule it outside the focus window for now AND add a focus_questions entry for it.'
    const lockNote = t.locked_time ? ` | LOCKED TIME: must be scheduled exactly at ${t.preferred_time}, never move it` : (t.preferred_time ? ` | requested time: ${t.preferred_time} (try to honor, not mandatory)` : '')
    return `- id=${t.id} | "${t.title}" | ${t.duration_minutes} min | priority=${t.priority} | category=${t.category} | ${focusNote} | rule=${t.category_window}${lockNote}`
  }).join('\n')}

INSTRUCTIONS:
- Place each task in a specific start/end time within the planning window, avoiding ALL fixed blocks completely and respecting each category's rule.
- Locked-time tasks MUST be scheduled at exactly their stated time - this is non-negotiable, place them first.
- Higher priority tasks get better slots.
- Leave the buffer between every two scheduled tasks.
- If total remaining time before ${dayEnd} is NOT enough to fit everything, do NOT cram tasks in past bedtime. Instead, leave the lowest-priority overflow task(s) unscheduled and put them in "conflicts" with type="overload" and a suggestion like "Not enough time today - move to tomorrow?" so the user can decide.
- If two tasks genuinely can't both be placed, or a category rule can't be satisfied anywhere available, flag as a conflict instead of violating a rule.
- For any task marked UNKNOWN focus status above, add an entry to "focus_questions" asking whether it's focus/study/work-related deep work. Still schedule it (outside the focus window) while asking.

Respond with ONLY valid JSON, no markdown, in exactly this shape:
{
  "scheduled": [{"task_id": "uuid", "start": "HH:MM", "end": "HH:MM"}],
  "conflicts": [{"task_ids": ["uuid"], "type": "overload|time_overlap|ambiguous_category", "suggestion": "short suggestion"}],
  "focus_questions": [{"task_id": "uuid", "question": "short yes/no question"}]
}`
}

async function callGroq(prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: 2500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`)

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No text response from Groq')

  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('Failed to parse AI response as JSON: ' + cleaned.slice(0, 200))
  }
}
