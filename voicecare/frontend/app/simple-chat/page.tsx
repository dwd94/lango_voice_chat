'use client'

import { useEffect, useState, useRef } from 'react'
import { Send, Mic, MicOff, Volume2, VolumeX, Languages, Wifi, WifiOff, Settings, RotateCcw, Play, Pause, Loader2 } from 'lucide-react'

interface Message {
  id: string
  text: string
  translated_text: string
  audio_url?: string
  audio_url_original?: string
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
  const [showLanguageSelector, setShowLanguageSelector] = useState(false)
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null)
  const [connectionRetries, setConnectionRetries] = useState(0)
  const [useParallelMode, setUseParallelMode] = useState(true) // Enable parallel mode by default
  const [processingStage, setProcessingStage] = useState<string>('')
  
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' }
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
    const wsUrl = useParallelMode ? 'ws://localhost:8000/ws/parallel' : 'ws://localhost:8000/ws'
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      setIsConnected(true)
      setConnectionRetries(0)
      console.log('Connected to WebSocket')
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'processing_started') {
          console.log('Processing started:', data.data.stage)
          setIsProcessing(true)
          setProcessingStage(data.data.stage)
        } else if (data.type === 'processing_update') {
          console.log('Processing update:', data.data.stage)
          setProcessingStage(data.data.stage)
          // Keep processing indicator active
        } else if (data.type === 'stt_result') {
          console.log('STT result received:', data.data.original_text)
          // Show STT result immediately
          const sttMessage: Message = {
            id: data.data.message_id,
            text: data.data.original_text,
            translated_text: 'Translating...',
            audio_url: undefined,
            audio_url_original: undefined,
            is_sender: true,
            timestamp: new Date().toLocaleTimeString()
          }
          setMessages(prev => [...prev, sttMessage])
        } else if (data.type === 'translation_result') {
          console.log('Translation result received:', data.data.translated_text)
          // Update the message with translation
          setMessages(prev => prev.map(msg => 
            msg.id === data.data.message_id 
              ? { ...msg, translated_text: data.data.translated_text }
              : msg
          ))
        } else if (data.type === 'translation_complete') {
          console.log('Translation complete:', data.data)
          const newMessage: Message = {
            id: data.data.message_id,
            text: data.data.original_text || 'Voice message',
            translated_text: data.data.translated_text,
            audio_url: data.data.audio_url || data.data.audio_url_translated,
            audio_url_original: data.data.audio_url_original,
            is_sender: true,
            timestamp: new Date().toLocaleTimeString()
          }
          
          // Update existing message or add new one
          setMessages(prev => {
            const existingIndex = prev.findIndex(msg => msg.id === data.data.message_id)
            if (existingIndex !== -1) {
              const updated = [...prev]
              updated[existingIndex] = newMessage
              return updated
            } else {
              return [...prev, newMessage]
            }
          })
          
          setIsProcessing(false) // Stop processing indicator
          
          // Auto-play the translated audio if available
          const audioUrl = data.data.audio_url || data.data.audio_url_translated
          if (audioUrl) {
            setTimeout(() => {
              playAudio(audioUrl)
            }, 500) // Small delay to ensure message is rendered
          }
        } else if (data.type === 'translation') {
          // Backward compatibility with old format
          const newMessage: Message = {
            id: data.data.message_id,
            text: data.data.original_text || 'Voice message',
            translated_text: data.data.translated_text,
            audio_url: data.data.audio_url,
            audio_url_original: data.data.audio_url_original,
            is_sender: true,
            timestamp: new Date().toLocaleTimeString()
          }
          
          setMessages(prev => [...prev, newMessage])
          setIsProcessing(false) // Stop processing indicator
          
          // Auto-play the translated audio if available
          const audioUrl = data.data.audio_url || data.data.audio_url_translated
          if (audioUrl) {
            setTimeout(() => {
              playAudio(audioUrl)
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
        setConnectionRetries(prev => prev + 1)
        const delay = Math.min(2000 * Math.pow(1.5, connectionRetries), 10000) // Exponential backoff, max 10s
        console.log(`Attempting to reconnect in ${delay/1000} seconds... (attempt ${connectionRetries + 1})`)
        setTimeout(() => {
          console.log('Reconnecting...')
          connectWebSocket()
        }, delay)
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
        console.log('🎵 MediaRecorder onstop event triggered')
        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log(`📦 Created audio blob: ${audioBlob.size} bytes, type: ${mimeType}`)
        
        // Validate audio blob for longer recordings
        if (audioBlob.size > 1000) { // At least 1KB
          // For longer recordings, add extra validation
          if (recordingTime > 5 && audioBlob.size < 5000) {
            console.warn('⚠️ Long recording but small file size, might be corrupted')
            alert('Recording seems corrupted. Please try again.')
            return
          }
          sendAudioMessage(audioBlob)
        } else {
          console.warn('⚠️ Audio too short, not sending')
          alert('Recording too short. Please speak for at least 1 second.')
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        console.log('🔇 Audio tracks stopped')
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
    console.log('🛑 stopRecording called, isRecording:', isRecording, 'mediaRecorder:', mediaRecorderRef.current)
    
    // Immediately update UI state for responsive feedback
    setIsRecording(false)
    
    // Clear the recording interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
      console.log('⏰ Recording interval cleared')
    }
    
    // Stop the MediaRecorder if it exists
    if (mediaRecorderRef.current) {
      try {
        console.log('📹 MediaRecorder state:', mediaRecorderRef.current.state)
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
          console.log('✅ MediaRecorder.stop() called')
        } else {
          console.log('⚠️ MediaRecorder not in recording state:', mediaRecorderRef.current.state)
        }
      } catch (error) {
        console.error('❌ Error stopping MediaRecorder:', error)
      }
    } else {
      console.warn('⚠️ No MediaRecorder reference found')
    }
    
    // Force cleanup after a short delay to ensure everything stops
    setTimeout(() => {
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state === 'recording') {
            console.log('🔄 Force stopping MediaRecorder...')
            mediaRecorderRef.current.stop()
          }
        } catch (error) {
          console.error('❌ Error in force stop:', error)
        }
      }
    }, 100)
    
    console.log('✅ Stop recording completed')
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

  const handleRecordingClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    console.log('🎤 Recording button clicked!')
    console.log('Current state:', { isRecording, isProcessing, isConnected })
    console.log('Button disabled:', !isConnected || isProcessing)

    if (isRecording) {
      console.log('🛑 Stopping recording...')
      stopRecording()
      return
    }

    // Prevent starting a new recording while processing or disconnected
    if (isProcessing || !isConnected) {
      console.log('❌ Cannot start - processing or not connected')
      return
    }

    console.log('▶️ Starting recording...')
    startRecording()
  }

  const playAudio = (audioUrl: string, messageId?: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    
    try {
      // Create a new audio element and play the base64 audio
      const audio = new Audio(audioUrl)
      audio.onplay = () => {
        setIsPlaying(true)
        if (messageId) setCurrentPlayingId(messageId)
        console.log('Audio started playing')
      }
      audio.onended = () => {
        setIsPlaying(false)
        setCurrentPlayingId(null)
        console.log('Audio finished playing')
      }
      audio.onerror = (error) => {
        console.error('Audio playback error:', error)
        setIsPlaying(false)
        setCurrentPlayingId(null)
        alert('Error playing audio')
      }
      
      audio.play().catch(error => {
        console.error('Error starting audio playback:', error)
        setIsPlaying(false)
        setCurrentPlayingId(null)
        alert('Could not play audio')
      })
    } catch (error) {
      console.error('Error creating audio element:', error)
      setIsPlaying(false)
      setCurrentPlayingId(null)
    }
  }


  const getLanguageByCode = (code: string) => languages.find(lang => lang.code === code)

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-blue-100 flex flex-col text-slate-900">
      {/* Enhanced Header */}
      <div className="glass-strong border-b border-indigo-100 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-indigo-900">Lango Voice Chat</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white border border-indigo-100 shadow-sm">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-emerald-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-500" />
              )}
              <span className={`text-sm font-medium ${isConnected ? 'text-emerald-600' : 'text-rose-500'}`}>
                {isConnected ? 'Connected' : `Reconnecting... (${connectionRetries})`}
              </span>
            </div>
            
            {/* Parallel Mode Toggle */}
            <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white border border-indigo-100 shadow-sm">
              <input
                type="checkbox"
                id="parallel-mode"
                checked={useParallelMode}
                onChange={(e) => setUseParallelMode(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="parallel-mode" className="text-sm font-medium text-indigo-700">
                Parallel Mode
              </label>
            </div>
            
            {/* Language Toggle */}
            <button
              onClick={() => setShowLanguageSelector(!showLanguageSelector)}
              className="p-2 rounded-lg bg-white border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-all duration-200"
            >
              <Settings className="w-5 h-5 text-indigo-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Language Selection */}
      <div className={`glass border-b border-indigo-100 transition-all duration-300 ${showLanguageSelector ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="max-w-6xl mx-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Language */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-indigo-700">
                From
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full p-3 rounded-xl bg-white border border-indigo-200 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-white text-slate-900">
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Target Language */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-indigo-700">
                To
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full p-3 rounded-xl bg-white border border-indigo-200 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-white text-slate-900">
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Quick Language Swap */}
          <div className="flex justify-center mt-4">
            <button
              onClick={() => {
                const temp = sourceLang
                setSourceLang(targetLang)
                setTargetLang(temp)
              }}
              className="p-2 rounded-lg bg-white border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-all duration-200"
            >
              <RotateCcw className="w-5 h-5 text-indigo-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Messages */}
      <div className="flex-1 overflow-y-auto p-4 dark-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-indigo-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Mic className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-indigo-900 mb-2">Start Your Conversation</h3>
              <p className="text-indigo-600 mb-4">Record a voice message to begin translating</p>
              <div className="flex items-center justify-center space-x-2 text-sm text-indigo-500">
                <span>{getLanguageByCode(sourceLang)?.flag} {getLanguageByCode(sourceLang)?.name}</span>
                <span>→</span>
                <span>{getLanguageByCode(targetLang)?.flag} {getLanguageByCode(targetLang)?.name}</span>
              </div>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div key={message.id} className="animate-slide-up space-y-4">
              {/* Original Message */}
              <div className="flex justify-end">
                <div className="glass-strong rounded-2xl px-6 py-4 max-w-lg relative group shadow-md">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-medium">U</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-900 text-sm leading-relaxed">{message.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-slate-500">{message.timestamp}</p>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-slate-500">{getLanguageByCode(sourceLang)?.flag}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Translated Message */}
              <div className="flex justify-start">
                <div className="glass rounded-2xl px-6 py-4 max-w-lg relative group shadow">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-medium">T</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-900 text-sm leading-relaxed">{message.translated_text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <p className="text-xs text-slate-500">{message.timestamp}</p>
                          <span className="text-xs text-slate-500">{getLanguageByCode(targetLang)?.flag}</span>
                        </div>
                        {message.audio_url && (
                          <button
                            onClick={() => playAudio(message.audio_url!, message.id)}
                            disabled={isPlaying && currentPlayingId !== message.id}
                            className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-all duration-200 disabled:opacity-50 group border border-indigo-100"
                          >
                            {currentPlayingId === message.id ? (
                              <div className="flex space-x-1">
                                <div className="w-1 h-3 bg-purple-400 rounded-full equalizer-bar"></div>
                                <div className="w-1 h-3 bg-purple-400 rounded-full equalizer-bar"></div>
                                <div className="w-1 h-3 bg-purple-400 rounded-full equalizer-bar"></div>
                                <div className="w-1 h-3 bg-purple-400 rounded-full equalizer-bar"></div>
                                <div className="w-1 h-3 bg-purple-400 rounded-full equalizer-bar"></div>
                              </div>
                            ) : (
                              <Volume2 className="w-4 h-4 text-indigo-600" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Enhanced Voice Recording Interface */}
      <div className="glass-strong border-t border-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center space-y-4">
            {/* Recording Status */}
            {isRecording && (
              <div className="flex flex-col items-center space-y-2 text-indigo-900">
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-600">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
                  <span className="text-xs font-medium text-rose-600">
                    Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')} / {maxRecordingTime}s
                  </span>
                </div>
                {/* Compact Progress Bar */}
                <div className="w-64 bg-indigo-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-rose-500 to-pink-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(recordingTime / maxRecordingTime) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Processing Status */}
            {isProcessing && (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-600">
                <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
                <span className="text-xs font-medium">
                  {processingStage ? `Processing: ${processingStage.replace('_', ' ')}` : 'Processing...'}
                </span>
              </div>
            )}

            {/* Enhanced Voice Recording Button */}
            <div className="relative">
              <button
                onClick={handleRecordingClick}
                disabled={isProcessing || (!isRecording && !isConnected)}
                className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                  isRecording 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-recording-pulse neon-glow-strong' 
                    : isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 neon-glow animate-float'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {isRecording ? <MicOff size={36} /> : <Mic size={36} />}
              </button>
              
              {/* Ripple Effect */}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping pointer-events-none"></div>
              )}
            </div>
            
            {/* Compact Instructions */}
            <div className="text-center">
              <p className="text-xs text-indigo-600">
                {isRecording 
                  ? 'Tap to stop recording' 
                  : isProcessing
                  ? 'Processing your audio...'
                  : 'Tap to start recording'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </div>
  )
}
