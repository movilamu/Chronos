import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useVoiceCommand() {
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [pendingContext, setPendingContext] = useState(null)
  const recognitionRef = useRef(null)

  const isSupported =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  // Speaks text, then reliably fires onDone once speech actually finishes
  // (using utterance.onend, not a guessed timeout - the old timeout-based
  // approach was the cause of "asks but doesn't listen").
  const speak = useCallback((text, onDone) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onDone?.()
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    let fired = false
    const finish = () => {
      if (fired) return
      fired = true
      onDone?.()
    }
    utterance.onend = finish
    utterance.onerror = finish
    // Safety net in case onend never fires on some browsers
    const fallback = setTimeout(finish, Math.max(2500, text.length * 90))
    utterance.onstart = () => clearTimeout(fallback)
    window.speechSynthesis.cancel() // clear any queued speech first
    window.speechSynthesis.speak(utterance)
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    setError(null)
    setTranscript('')

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join('')
      setTranscript(text)
    }

    recognition.onerror = (event) => {
      setError(event.error === 'no-speech' ? "Didn't catch that, try again." : event.error)
      setListening(false)
    }

    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      // Recognition sometimes throws if called too soon after a previous
      // session ended - retry once after a short delay.
      setTimeout(() => {
        try {
          recognition.start()
          setListening(true)
        } catch (e2) {
          setError('Could not start the microphone: ' + e2.message)
        }
      }, 250)
    }
  }, [isSupported])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const submitCommand = useCallback(async (text, contextOverride, onIntentHandled) => {
    const finalText = text ?? transcript
    if (!finalText.trim()) return
    setProcessing(true)
    setError(null)
    try {
      const activeContext = contextOverride !== undefined ? contextOverride : pendingContext
      const { data, error: fnError } = await supabase.functions.invoke('voice-command', {
        body: { transcript: finalText, context: activeContext },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setResult(data)

      onIntentHandled?.(data)

      if (data?.awaitingDuration) {
        setPendingContext({ type: 'awaiting_duration', task_id: data.awaitingDuration.task_id })
        setTranscript('')
        if (data?.speak && data?.message) {
          speak(data.message, () => {
            setResult(null)
            startListening()
          })
        } else {
          startListening()
        }
      } else {
        setPendingContext(null)
        if (data?.speak && data?.message) speak(data.message)
      }

      return data
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }, [transcript, pendingContext, speak, startListening])

  const reset = () => {
    setTranscript('')
    setResult(null)
    setError(null)
    setPendingContext(null)
  }

  return {
    isSupported,
    listening,
    processing,
    transcript,
    result,
    error,
    pendingContext,
    startListening,
    stopListening,
    submitCommand,
    reset,
  }
}
