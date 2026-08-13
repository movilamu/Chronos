import { useEffect } from 'react'
import { Mic, MicOff, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useVoiceCommand } from '../hooks/useVoiceCommand'
import { useScheduler } from '../hooks/useScheduler'

export default function VoiceButton() {
  const {
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
  } = useVoiceCommand()
  const { planDay } = useScheduler()

  const isOpen = listening || processing || !!result || !!error || !!pendingContext

  // Auto-submit shortly after speech recognition ends with a transcript
  useEffect(() => {
    if (!listening && transcript && !processing && !result) {
      submitCommand(transcript, undefined, (data) => {
        // Voice-created/deleted/rescheduled tasks need a replan too - this was
        // previously missing, so voice-added tasks never got a scheduled time.
        const action = data?.intent?.action
        if (['add_task', 'delete_task', 'reschedule_task'].includes(action)) {
          const date = data?.intent?.target_date || new Date().toISOString().slice(0, 10)
          planDay(date)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  if (!isSupported) return null

  return (
    <>
      <button
        onClick={listening ? stopListening : startListening}
        className={
          'fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition md:bottom-8 ' +
          (listening ? 'bg-red-500 text-white' : 'bg-brand-600 text-white hover:bg-brand-700')
        }
        title="Voice command"
      >
        {listening ? <MicOff size={22} /> : <Mic size={22} />}
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-xl md:bottom-28">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              {listening ? 'Listening...' : processing ? 'Thinking...' : pendingContext ? 'Waiting for your answer...' : 'Voice command'}
            </span>
            <button
              onClick={reset}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X size={16} />
            </button>
          </div>

          {transcript && (
            <p className="mb-2 text-sm italic text-[var(--text-primary)]">"{transcript}"</p>
          )}

          {processing && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 size={14} className="animate-spin" /> Processing your command...
            </div>
          )}

          {result && !error && (
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-500" />
              <span className="text-[var(--text-primary)]">{result.message}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
              <span className="text-[var(--text-primary)]">{error}</span>
            </div>
          )}

          {!listening && !processing && !pendingContext && (
            <button
              onClick={startListening}
              className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Speak again
            </button>
          )}
        </div>
      )}
    </>
  )
}
