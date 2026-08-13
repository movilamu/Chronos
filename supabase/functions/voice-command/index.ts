// supabase/functions/voice-command/index.ts
// Deploy: supabase functions deploy voice-command
//
// Input: { transcript: "add gym for 1 hour high priority" }
// Uses Claude to classify intent (add/complete/reschedule/delete/query) + extract fields,
// then executes the DB action directly. Ambiguous commands are written to
// schedule_conflicts (type=voice_ambiguous) instead of guessing.

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

    const { transcript, context } = await req.json()
    if (!transcript) throw new Error('transcript is required')

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const todayStr = new Date().toISOString().slice(0, 10)

    // Second turn of a "how long did it take?" exchange: parse a duration
    // from this transcript and complete the task, instead of re-interpreting
    // it as a brand new command.
    if (context?.type === 'awaiting_duration' && context?.task_id) {
      const minutes = await parseDurationFromSpeech(transcript)
      const { data: task } = await db.from('tasks').select('*').eq('id', context.task_id).single()
      if (!task) return json({ message: "Couldn't find that task anymore.", speak: true })

      const actualMinutes = minutes || task.duration_minutes
      await db.from('tasks').update({ status: 'done', actual_hours: (actualMinutes / 60).toFixed(2) }).eq('id', task.id)
      await db.from('time_logs').insert({
        task_id: task.id,
        user_id: user.id,
        actual_start: task.scheduled_start || new Date().toISOString(),
        actual_end: new Date().toISOString(),
        actual_duration_minutes: actualMinutes,
      })

      const h = Math.floor(actualMinutes / 60)
      const m = actualMinutes % 60
      return json({
        message: `Logged ${h ? h + 'h ' : ''}${m}m for "${task.title}" and marked it done.`,
        speak: true,
        done: true,
      })
    }

    const [{ data: categories }, { data: todayTasks }] = await Promise.all([
      db.from('categories').select('id, name').eq('user_id', user.id),
      db.from('tasks').select('id, title, status, duration_minutes, scheduled_start').eq('user_id', user.id).eq('target_date', todayStr),
    ])

    const intent = await interpretCommand(transcript, categories || [], todayTasks || [])

    let resultMessage = ''
    let needsInput = false
    let awaitingDuration = null

    switch (intent.action) {
      case 'add_task': {
        const category = matchCategory(intent.category, categories)
        const { data: inserted, error } = await db
          .from('tasks')
          .insert({
            user_id: user.id,
            title: intent.title,
            duration_minutes: intent.duration_minutes || 30,
            priority: intent.priority || 'medium',
            category_id: category?.id || null,
            target_date: intent.target_date || todayStr,
            status: 'pending',
            source: 'voice',
          })
          .select()
          .single()
        if (error) throw error
        resultMessage = `Added "${inserted.title}" (${inserted.duration_minutes} min, ${inserted.priority} priority)`
        break
      }

      case 'complete_task': {
        const task = matchTask(intent.task_title, todayTasks)
        if (!task) {
          resultMessage = `Couldn't find a task matching "${intent.task_title}" today.`
          needsInput = true
          break
        }
        // Don't mark done yet - ask how long it actually took first (spoken follow-up)
        resultMessage = `Got it. How long did "${task.title}" actually take?`
        awaitingDuration = { task_id: task.id, task_title: task.title }
        break
      }

      case 'delete_task': {
        const task = matchTask(intent.task_title, todayTasks)
        if (!task) {
          resultMessage = `Couldn't find a task matching "${intent.task_title}" today.`
          needsInput = true
          break
        }
        await db.from('tasks').delete().eq('id', task.id)
        resultMessage = `Deleted "${task.title}"`
        break
      }

      case 'reschedule_task': {
        const task = matchTask(intent.task_title, todayTasks)
        if (!task) {
          resultMessage = `Couldn't find a task matching "${intent.task_title}" today.`
          needsInput = true
          break
        }
        if (intent.shift_minutes) {
          const { data: full } = await db.from('tasks').select('*').eq('id', task.id).single()
          if (full?.scheduled_start) {
            const newStart = new Date(new Date(full.scheduled_start).getTime() + intent.shift_minutes * 60000)
            const newEnd = new Date(newStart.getTime() + full.duration_minutes * 60000)
            await db.from('tasks').update({
              scheduled_start: newStart.toISOString(),
              scheduled_end: newEnd.toISOString(),
            }).eq('id', task.id)
            resultMessage = `Shifted "${task.title}" by ${intent.shift_minutes} minutes`
          }
        } else {
          resultMessage = `Marked "${task.title}" to be re-planned`
          await db.from('tasks').update({ status: 'pending' }).eq('id', task.id)
        }
        break
      }

      case 'query':
        resultMessage = 'Query understood — check the Today or Tasks page for details.'
        break

      default:
        resultMessage = "I didn't understand that clearly."
        needsInput = true
    }

    if (needsInput || intent.ambiguous) {
      await db.from('schedule_conflicts').insert({
        user_id: user.id,
        task_ids: [],
        conflict_type: 'voice_ambiguous',
        ai_suggestion: `You said: "${transcript}". ${resultMessage}`,
        status: 'pending',
      })
    }

    return json({ intent, message: resultMessage, needsInput, awaitingDuration, speak: true })
  } catch (err) {
    console.error(err)
    return json({ error: err.message }, 400)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function matchCategory(name, categories) {
  if (!name) return null
  return categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    || categories.find((c) => c.name.toLowerCase().includes(name.toLowerCase()))
}

function matchTask(title, tasks) {
  if (!title) return null
  const lower = title.toLowerCase()
  return tasks.find((t) => t.title.toLowerCase() === lower)
    || tasks.find((t) => t.title.toLowerCase().includes(lower) || lower.includes(t.title.toLowerCase()))
}

async function parseDurationFromSpeech(transcript) {
  const prompt = `Extract a total duration in minutes from this spoken answer to "how long did it take?".
TRANSCRIPT: "${transcript}"
Examples: "20 minutes" -> 20. "half an hour" -> 30. "an hour and a half" -> 90. "1 hour 15" -> 75. "not sure" -> null.
Respond with ONLY valid JSON: {"minutes": number or null}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: 100,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  try {
    const parsed = JSON.parse(text.replace(/```json\s*|\s*```/g, '').trim())
    return parsed.minutes || null
  } catch {
    return null
  }
}

async function interpretCommand(transcript, categories, todayTasks) {
  const prompt = `Interpret this voice command for a task planner app.

TRANSCRIPT: "${transcript}"

AVAILABLE CATEGORIES: ${categories.map((c) => c.name).join(', ') || 'none'}
TODAY'S TASKS: ${todayTasks.map((t) => `"${t.title}" (${t.status})`).join(', ') || 'none'}

Classify into exactly one action: add_task, complete_task, delete_task, reschedule_task, or query.
Extract relevant fields. If the command is unclear or doesn't map cleanly, set "ambiguous": true.

Respond with ONLY valid JSON, no markdown:
{
  "action": "add_task|complete_task|delete_task|reschedule_task|query",
  "title": "task name if adding",
  "duration_minutes": number or null,
  "priority": "high|medium|low or null",
  "category": "category name or null",
  "target_date": "YYYY-MM-DD or null (default today)",
  "task_title": "task name to match, for complete/delete/reschedule",
  "shift_minutes": number or null,
  "ambiguous": boolean
}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: 500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`)

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
  return JSON.parse(cleaned)
}
