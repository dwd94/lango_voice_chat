'use client'

import { useEffect, useState, useRef } from 'react'
import { Send, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'

interface Message {
  id: string
  text: string
  translated_text: string
  audio_url?: string
  is_sender: boolean
  timestamp: string
}

export default function SimpleChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [maxRecordingTime] = useState(30) // Maximum 30 seconds (reduced for stability)
  
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' }
  ]

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop recording when max time is reached
          if (newTime >= maxRecordingTime) {
            stopRecording()
            alert(`Maximum recording time of ${maxRecordingTime} seconds reached.`)
          }
          return newTime
        })
      }, 1000)
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      setRecordingTime(0)
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [isRecording, maxRecordingTime])

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/ws')
    
    ws.onopen = () => {
      setIsConnected(true)
      console.log('Connected to WebSocket')
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'translation') {
          const newMessage: Message = {
            id: data.data.message_id,
            text: data.data.original_text || 'Voice message',
            translated_text: data.data.translated_text,
            audio_url: data.data.audio_url,
            is_sender: true,
            timestamp: new Date().toLocaleTimeString()
          }
          
          setMessages(prev => [...prev, newMessage])
          setIsProcessing(false) // Stop processing indicator
          
          // Auto-play the translated audio if available
          if (data.data.audio_url) {
            setTimeout(() => {
              playAudio(data.data.audio_url)
            }, 500) // Small delay to ensure message is rendered
          }
        } else if (data.type === 'error') {
          console.error('Translation error:', data.message)
          alert(`Translation error: ${data.message}`)
          setIsProcessing(false) // Stop processing indicator on error
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
        setIsProcessing(false)
      }
    }
    
    ws.onclose = (event) => {
      setIsConnected(false)
      setIsProcessing(false)
      console.log('Disconnected from WebSocket:', event.code, event.reason)
      
      // Try to reconnect for any non-normal closure
      if (event.code !== 1000) {
        console.log('Attempting to reconnect in 2 seconds...')
        setTimeout(() => {
          console.log('Reconnecting...')
          connectWebSocket()
        }, 2000)
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
      setIsProcessing(false)
      
      // Try to reconnect on error
      console.log('WebSocket error, attempting to reconnect in 3 seconds...')
      setTimeout(() => {
        console.log('Reconnecting after error...')
        connectWebSocket()
      }, 3000)
    }
    
    wsRef.current = ws
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      // Try to use a more compatible format for longer recordings
      const options = { 
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000 // Higher bitrate for better quality
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm'
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/mp4'
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/wav'
      }
      
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log(`Created audio blob: ${audioBlob.size} bytes, type: ${mimeType}`)
        
        // Validate audio blob for longer recordings
        if (audioBlob.size > 1000) { // At least 1KB
          // For longer recordings, add extra validation
          if (recordingTime > 5 && audioBlob.size < 5000) {
            console.warn('Long recording but small file size, might be corrupted')
            alert('Recording seems corrupted. Please try again.')
            return
          }
          sendAudioMessage(audioBlob)
        } else {
          console.warn('Audio too short, not sending')
          alert('Recording too short. Please speak for at least 1 second.')
        }
        
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start(250) // Collect data every 250ms for better stability with longer recordings
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Could not access microphone. '
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Permission denied. Please:\n1. Click the microphone icon in your browser address bar\n2. Select "Allow" for microphone access\n3. Refresh the page and try again'
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'No microphone found. Please:\n1. Check if a microphone is connected\n2. Make sure it\'s not being used by another app\n3. Try a different browser'
        } else if (error.name === 'NotReadableError') {
          errorMessage += 'Microphone is being used by another app. Please:\n1. Close other apps using the microphone\n2. Refresh the page and try again'
        } else {
          errorMessage += 'Please check your microphone permissions and try again.'
        }
      } else {
        errorMessage += 'Please check your microphone permissions and try again.'
      }
      
      alert(errorMessage)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!wsRef.current || !isConnected) {
      console.warn('WebSocket not connected, cannot send audio')
      return
    }

    try {
      // Show processing indicator
      setIsProcessing(true)
      
      // Validate audio blob before processing
      if (audioBlob.size > 10 * 1024 * 1024) { // 10MB limit (reduced for stability)
        throw new Error('Audio file too large (max 10MB)')
      }
      
      // Convert audio to base64 using FileReader (more efficient for large files)
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove data URL prefix if present
          const base64 = result.includes(',') ? result.split(',')[1] : result
          resolve(base64)
        }
        reader.onerror = () => reject(new Error('Failed to read audio file'))
        reader.readAsDataURL(audioBlob)
      })
      
      console.log(`Sending audio: ${audioBlob.size} bytes, base64 length: ${base64Audio.length}, duration: ${recordingTime}s`)

      const message = {
        audio_data: base64Audio,
        source_lang: sourceLang,
        target_lang: targetLang,
        sender_id: 'user1'
      }

      // Check if WebSocket is still connected before sending
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message))
      } else {
        throw new Error('WebSocket connection lost')
      }
    } catch (error) {
      console.error('Error sending audio message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Error sending audio message: ${errorMessage}`)
      setIsProcessing(false) // Stop processing indicator on error
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    
    try {
      // Create a new audio element and play the base64 audio
      const audio = new Audio(audioUrl)
      audio.onplay = () => {
        setIsPlaying(true)
        console.log('Audio started playing')
      }
      audio.onended = () => {
        setIsPlaying(false)
        console.log('Audio finished playing')
      }
      audio.onerror = (error) => {
        console.error('Audio playback error:', error)
        setIsPlaying(false)
        alert('Error playing audio')
      }
      
      audio.play().catch(error => {
        console.error('Error starting audio playback:', error)
        setIsPlaying(false)
        alert('Could not play audio')
      })
    } catch (error) {
      console.error('Error creating audio element:', error)
      setIsPlaying(false)
    }
  }


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Lango Voice Chat</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Connected ' : 'Disconnected - Reconnecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Language Selection */}
      <div className="bg-white border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 bg-white"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
          <div className="text-gray-400">→</div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 bg-white"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p>Start a conversation by recording a voice message</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              {/* Original Message */}
              <div className="flex justify-end">
                <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs opacity-75 mt-1">{message.timestamp}</p>
                </div>
              </div>
              
              {/* Translated Message */}
              <div className="flex justify-start">
                <div className="bg-white border rounded-lg px-4 py-2 max-w-xs lg:max-w-md shadow-sm">
                  <p className="text-sm text-gray-800">{message.translated_text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">{message.timestamp}</p>
                    {message.audio_url && (
                      <button
                        onClick={() => playAudio(message.audio_url!)}
                        disabled={isPlaying}
                        className="ml-2 p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      >
                        {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Voice Recording Interface */}
      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center space-y-4">
            {/* Recording Status */}
            {isRecording && (
              <div className="flex flex-col items-center space-y-2 text-red-500">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">
                    Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')} / {maxRecordingTime}s
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-64 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(recordingTime / maxRecordingTime) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Processing Status */}
            {isProcessing && (
              <div className="flex items-center space-x-2 text-blue-500">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-spin"></div>
                <span className="text-sm font-medium">
                  Processing audio and translating...
                </span>
              </div>
            )}

            
            {/* Voice Recording Button */}
            <button
              onClick={toggleRecording}
              disabled={!isConnected || isProcessing}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
            
            {/* Instructions */}
            <p className="text-sm text-gray-500 text-center">
              {isRecording 
                ? 'Click the microphone to stop recording' 
                : isProcessing
                ? 'Processing your audio...'
                : 'Click the microphone to start recording'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </div>
  )
}
