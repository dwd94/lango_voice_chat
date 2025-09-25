'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  maxDuration?: number
  disabled?: boolean
}

export default function AudioRecorder({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  maxDuration = 120,
  disabled = false
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  const startRecording = useCallback(async () => {
    if (disabled || isRecording) {
      return
    }

    setIsInitializing(true)
    setError('')

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = stream
      chunksRef.current = []

      // Create MediaRecorder with WebM/Opus format
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { 
          type: 'audio/webm;codecs=opus' 
        })
        const recordingDuration = duration
        
        onRecordingComplete(audioBlob, recordingDuration)
        cleanup()
      }

      // Start recording
      mediaRecorder.start(100) // Collect data every 100ms
      startTimeRef.current = Date.now()
      setIsRecording(true)
      setIsInitializing(false)
      onRecordingStart?.()

      // Start timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setDuration(elapsed)

        // Auto-stop at max duration
        if (elapsed >= maxDuration ) {
          stopRecording()
        }
      }, 1000)

    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Microphone access denied or not available')
      setIsInitializing(false)
      cleanup()
    }
  }, [disabled, isRecording, maxDuration, onRecordingComplete, onRecordingStart])

  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return

    mediaRecorderRef.current.stop()
    setIsRecording(false)
    onRecordingStop?.()
  }, [isRecording, onRecordingStop])

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null
    }
    
    chunksRef.current = []
    setDuration(0)
    setError('')
    setIsRecording(false)
    setIsInitializing(false)
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return (
    <div className="flex items-center space-x-4">
      {/* Recording Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isInitializing}
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110' 
            : 'btn-primary hover:scale-105'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isInitializing ? 'animate-spin' : ''}
        `}
      >
        {isInitializing ? (
          <Loader2 className="w-6 h-6 text-white" />
        ) : isRecording ? (
          <Square className="w-6 h-6 text-white" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
        
        {/* Recording pulse ring */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
        )}
      </button>

      {/* Recording Status */}
      {(isRecording || isInitializing) && (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-medium">
              {isInitializing ? 'Initializing...' : formatDuration(duration)}
            </span>
          </div>
          {isRecording && (
            <div className="text-purple-200 text-sm">
              {maxDuration - duration}s left
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-red-400 text-sm bg-red-500/20 px-3 py-1 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
} 