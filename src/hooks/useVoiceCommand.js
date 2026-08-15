import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

const isNative = Capacitor.isNativePlatform()

export function useVoiceCommand() {
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [pendingContext, setPendingContext] = useState(null)
  const [nativeSupported, setNativeSupported] = useState(true)
  const recognitionRef = useRef(null)
  const partialListenerRef = useRef(null)

  const webSupported =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  const isSupported = isNative ? nativeSupported : webSupported

  // Check native availability once on mount
  useEffect(() => {
    if (!isNative) return
    SpeechRecognition.available()
      .then((res) => setNativeSupported(!!res.available))
      .catch(() => setNativeSupported(false))
  }, [])

  // Speaks text, then reliably fires onDone once speech actually finishes
  // (using utterance.onend, not a guessed timeout - the old timeout-based
  // approach was the cause of "asks but doesn't listen"). Web only - native
  // TTS could be added later via @capacitor-community/text-to-speech if needed.
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

  // ---- NATIVE (Android APK) path ----
  const startListeningNative = useCallback(async () => {
    setError(null)
    setTranscript('')
    try {
      const perm = await SpeechRecognition.checkPermissions()
      if (perm.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions()
        if (req.speechRecognition !== 'granted') {
          setError('Microphone permission was denied. Enable it in phone Settings > Apps > Chronos > Permissions.')
          return
        }
      }

      if (partialListenerRef.current) {
        partialListenerRef.current.remove()
        partialListenerRef.current = null
      }

      partialListenerRef.current = await SpeechRecognition.addListener('partialResults', (data) => {
        const text = data?.matches?.[0]
        if (text) setTranscript(text)
      })

      setListening(true)
      const result = await SpeechRecognition.start({
        language: 'en-US',
        partialResults: true,
        popup: false,
      })
      const finalText = result?.matches?.[0]
      if (finalText) setTranscript(finalText)
      setListening(false)
    } catch (e) {
      setListening(false)
      setError(e?.message === 'No matches found' ? "Didn't catch that, try again." : (e?.message || 'Voice recognition failed'))
    }
  }, [])

  const stopListeningNative = useCallback(async () => {
    try {
      await SpeechRecognition.stop()
    } catch {
      // ignore
    }
    setListening(false)
  }, [])

  // ---- WEB path (unchanged behavior) ----
  const startListeningWeb = useCallback(() => {
    if (!webSupported) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    setError(null)
    setTranscript('')

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
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
  }, [webSupported])

  const stopListeningWeb = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const startListening = isNative ? startListeningNative : startListeningWeb
  const stopListening = isNative ? stopListeningNative : stopListeningWeb

  useEffect(() => {
    return () => {
      if (partialListenerRef.current) partialListenerRef.current.remove()
    }
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
