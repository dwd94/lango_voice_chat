'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Users, Wifi, WifiOff, Volume2, VolumeX, AlertCircle } from 'lucide-react'

import AudioRecorder from '../components/AudioRecorder'
import MessageBubble from '../components/MessageBubble'
import { useWebSocket } from '../hooks/useWebSocket'

interface User {
  id: string
  name: string
  role: string
  preferred_lang: string
}

interface Message {
  id: string
  sender_id: string
  sender_name: string
  sender_role: string
  text_source: string
  text_translated: string | null
  source_lang: string
  target_lang: string
  status: 'sent' | 'delivered' | 'played'
  created_at: string
  audio_url?: string
  duration?: number
}

interface Conversation {
  id: string
  user_a_id: string
  user_b_id: string
  user_a_name: string
  user_b_name: string
  created_at: string
  user_a?: User
  user_b?: User
}

export default function ChatPage() {
  const searchParams = useSearchParams()
  const conversationId = searchParams?.get('conversationId')
  const [user, setUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const isTranscribingRef = useRef(false)
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<HTMLAudioElement | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [useWebSocketMode, setUseWebSocketMode] = useState(true)
  const [showStartChat, setShowStartChat] = useState(false)
  const [modelInfo, setModelInfo] = useState<null | {
    stt: { provider: string; model?: string }
    tts: { provider: string; model?: string; voice?: string }
    translation: { provider: string; model?: string }
  }>(null)

  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // WebSocket connection
  const { 
    isConnected, 
    isConnecting, 
    send: sendWebSocketMessage
  } = useWebSocket({
    userId: user?.id,
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      console.error('WebSocket error:', error)
      setError(error)
    }
  })

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])


  // Initialize user and load conversations
  useEffect(() => {
    initializeUser()
    // Also fetch model/provider info for display
    fetch('/api/v1/capabilities/models')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch models')))
      .then(data => setModelInfo(data))
      .catch(err => console.warn('Model info load failed:', err))
  }, [])

  // Sync URL with active conversation
  useEffect(() => {
    if (activeConversation && router) {
      // Update URL without causing a page reload
      const newUrl = `/chat?conversationId=${activeConversation.id}`;
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [activeConversation, router]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id)
    }
  }, [activeConversation])
  
  // Handle conversation selection
  const handleConversationSelect = useCallback((conversation: Conversation) => {
    setActiveConversation(conversation);
  }, [])

  const initializeUser = async () => {
    try {
      const token = localStorage.getItem('voicecare_token')
      const userData = localStorage.getItem('voicecare_user')
      
      if (!token || !userData) {
        router.push('/auth/login')
        return
      }

      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)

      await loadConversations(parsedUser.id)
    } catch (error) {
      console.error('Failed to initialize user:', error)
      localStorage.removeItem('voicecare_token')
      localStorage.removeItem('voicecare_user')
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }


  const loadConversations = async (userId: string) => {
    try {
      // Try to load conversations from API first
      const response = await fetch('/api/v1/conversations/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('voicecare_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const apiConversations = await response.json();
        if (apiConversations && apiConversations.length > 0) {
          const formattedConversations: Conversation[] = apiConversations.map((conv: any) => ({
            id: conv.id,
            user_a_id: conv.user_a_id,
            user_b_id: conv.user_b_id,
            user_a_name: conv.user_a?.name || 'User A',
            user_b_name: conv.user_b?.name || 'User B',
            created_at: conv.created_at,
            user_a: conv.user_a,
            user_b: conv.user_b
          }));
          
          setConversations(formattedConversations);
          
          // If we have a conversationId in URL, find and set that conversation
          if (conversationId) {
            const targetConversation = formattedConversations.find(c => c.id === conversationId);
            if (targetConversation) {
              setActiveConversation(targetConversation);
              return;
            }
          }
          
          // Otherwise auto-select first conversation
          if (formattedConversations.length > 0) {
            setActiveConversation(formattedConversations[0]);
          }
          return;
        }
      }
      
      // Fallback: Create a conversation between Ana and Ben if none exist
      console.log('No conversations found, creating one between Ana (2) and Ben (3)');
      const createResponse = await fetch('/api/v1/conversations/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('voicecare_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_a_id: '2', // Ana
          user_b_id: '3'  // Ben
        })
      });
      
      if (createResponse.ok) {
        const newConv = await createResponse.json();
        const conversation: Conversation = {
          id: newConv.id,
          user_a_id: newConv.user_a_id,
          user_b_id: newConv.user_b_id,
          user_a_name: newConv.user_a?.name || 'Ana Rodriguez',
          user_b_name: newConv.user_b?.name || 'Ben Smith',
          created_at: newConv.created_at,
          user_a: newConv.user_a,
          user_b: newConv.user_b
        };
        
        setConversations([conversation]);
        setActiveConversation(conversation);
        console.log('Created new conversation:', conversation.id);
      } else {
        throw new Error('Failed to create conversation');
      }
      
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('Failed to load conversations');
      
      // Last resort fallback to mock data
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          user_a_id: '2', // Ana
          user_b_id: '3', // Ben
          user_a_name: 'Ana Rodriguez',
          user_b_name: 'Ben Smith',
          created_at: new Date().toISOString(),
          user_a: { id: '2', name: 'Ana Rodriguez', role: 'admin', preferred_lang: 'es' },
          user_b: { id: '3', name: 'Ben Smith', role: 'nurse', preferred_lang: 'en' }
        }
      ];
      
      setConversations(mockConversations);
      if (mockConversations.length > 0) {
        setActiveConversation(mockConversations[0]);
      }
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/v1/messages/${conversationId}`)
      if (!res.ok) throw new Error('Failed to load messages')
      const payload = await res.json()
      const apiMessages = (payload.messages || []) as any[]
      const list: Message[] = apiMessages.map((m) => {
        const isOwnMessage = user && m.sender_id === user.id
        return {
          id: m.id,
          sender_id: m.sender_id,
          sender_name: m.sender?.name || 'Unknown',
          sender_role: m.sender?.role || 'user',
          text_source: m.text_source,
          // For sender's own messages, don't show translated text
          // For received messages, show translated text
          text_translated: isOwnMessage ? null : m.text_translated,
          source_lang: m.source_lang,
          target_lang: m.target_lang,
          status: (m.status || 'sent').toLowerCase(),
          created_at: m.created_at,
        }
      })
      setMessages(list)
    } catch (error) {
      console.error('Failed to load messages:', error)
      setError('Failed to load messages')
    }
  }

  function handleWebSocketMessage(message: any) {
    console.log('Received WebSocket message:', message)
    
    if (message.type === 'message') {
      // New message received
      console.log(`Message from ${message.message.sender?.name}: "${message.message.text_source}" → "${message.message.text_translated}"`)
      console.log(`Language: ${message.message.source_lang} → ${message.message.target_lang}`)
      
      const isOwnMessage = user && message.message.sender_id === user.id
      const newMessage: Message = {
        id: message.message.id,
        sender_id: message.message.sender_id,
        sender_name: message.message.sender?.name || 'Unknown',
        sender_role: message.message.sender?.role || 'user',
        text_source: message.message.text_source,
        // For sender's own messages, don't show translated text
        // For received messages, show translated text
        text_translated: isOwnMessage ? null : message.message.text_translated,
        source_lang: message.message.source_lang,
        target_lang: message.message.target_lang,
        status: 'delivered',
        created_at: message.message.created_at,
        duration: message.play_now?.duration
      }

      setMessages(prev => {
        // If this is our own message, replace the last optimistic temp message instead of duplicating
        if (user && newMessage.sender_id === user.id) {
          const idx = [...prev].reverse().findIndex(m => m.sender_id === user.id && m.id.startsWith('temp-') && m.text_source === newMessage.text_source)
          if (idx !== -1) {
            const realIdx = prev.length - 1 - idx
            const existing = prev[realIdx]
            const merged: Message = {
              ...newMessage,
              // Preserve any generated audio/duration from the optimistic message
              audio_url: existing.audio_url || newMessage.audio_url,
              duration: existing.duration || newMessage.duration,
            }
            const copy = [...prev]
            copy[realIdx] = merged
            return copy
          }
        }
        console.log(`Adding message to chat: ${newMessage.sender_name} → ${newMessage.text_translated}`)
        return [...prev, newMessage]
      })

      // Generate TTS audio URL for the message and auto-play if not muted
      if (message.play_now) {
        console.log(`Auto-playing TTS: "${message.play_now.text}" in ${message.play_now.lang}`)
        generateTTSAudio(message.play_now.text, message.play_now.lang, newMessage.id, !isMuted, message.play_now.sender_gender, message.play_now.sender_id)
      }
    }
  }

  const generateTTSAudio = async (text: string, language: string, messageId: string, autoPlay: boolean = false, senderGender?: string, senderId?: string) => {
    try {
      const response = await fetch('/api/v1/tts/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          lang: language, // Fixed: use 'lang' instead of 'language'
          voice_hint: null, // Let backend choose best voice
          sender_gender: senderGender, // Pass sender gender for voice selection
          sender_id: senderId // Pass sender ID for persistent gender assignment
        })
      })

      if (response.ok) {
        const ttsResponse = await response.json()
        
        if (ttsResponse.needs_browser_fallback || !ttsResponse.audio_base64) {
          console.log('Using browser TTS fallback')
          // Use browser speech synthesis as fallback
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = language
          speechSynthesis.speak(utterance)
          return
        }
        
        // Decode base64 audio data
        const audioData = atob(ttsResponse.audio_base64)
        const audioArray = new Uint8Array(audioData.length)
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i)
        }
        
        const audioBlob = new Blob([audioArray], { type: ttsResponse.content_type || 'audio/mpeg' })
        const audioUrl = URL.createObjectURL(audioBlob)
        
        // Update the message with audio URL and estimated duration
        const estimatedDuration = Math.max(text.length * 0.1, 1) // Rough estimate: 0.1 seconds per character
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, audio_url: audioUrl, duration: estimatedDuration }
            : msg
        ))

        // Auto-play if requested
        if (autoPlay) {
          playAudioFromUrl(audioUrl, messageId)
        }
        
        console.log(`Generated TTS audio for message ${messageId}: ${audioBlob.size} bytes`)
      } else {
        console.error('TTS request failed:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('TTS error details:', errorText)
      }
    } catch (error) {
      console.error('Failed to generate TTS audio:', error)
    }
  }

  const playAudioFromUrl = async (audioUrl: string, messageId: string) => {
    try {
      // Stop any currently playing audio
      if (currentlyPlayingAudio) {
        currentlyPlayingAudio.pause()
        currentlyPlayingAudio.currentTime = 0
      }

      const audio = new Audio(audioUrl)
      setCurrentlyPlayingAudio(audio)

      audio.onended = () => {
        setCurrentlyPlayingAudio(null)
        if (useWebSocketMode) {
          // sendPlayedStatus(messageId) // This function is no longer available from useWebSocket
        }
      }

      await audio.play()
    } catch (error) {
      console.error('Failed to play audio:', error)
    }
  }

  const playTTSAudio = async (text: string, language: string, messageId: string) => {
    // This function is now just a wrapper for generateTTSAudio with autoPlay
    await generateTTSAudio(text, language, messageId, true, undefined, undefined)
  }

  const onRecordingStart = useCallback(() => {
    setIsRecording(true)
  }, [])

  const onRecordingStop = useCallback(() => {
    setIsRecording(false)
  }, [])

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, duration: number) => {
    if (!user || !activeConversation) return

    // Prevent multiple simultaneous transcriptions
    if (isTranscribingRef.current) {
      return
    }

    isTranscribingRef.current = true
    setIsTranscribing(true)
    setError('')

    // Set a timeout to ensure transcribing state is reset
    const transcribingTimeout = setTimeout(() => {
      setIsTranscribing(false)
    }, 30000) // 30 second timeout

    try {
      // Step 1: Transcribe audio using STT
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      // Send user's preferred language as hint for better detection
      formData.append('language', user.preferred_lang)

      const sttResponse = await fetch('/api/v1/stt/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!sttResponse.ok) {
        throw new Error('Failed to transcribe audio')
      }

      const sttResult = await sttResponse.json()
      
      if (sttResult.error) {
        throw new Error(sttResult.error)
      }

      const transcribedText = sttResult.text
      const detectedLang = sttResult.language

      // Only proceed if we have transcribed text
      if (transcribedText.trim()) {
        // Determine target language (recipient's preferred language)
        const recipientId = activeConversation.user_a_id === user.id 
          ? activeConversation.user_b_id 
          : activeConversation.user_a_id
        
        // Get recipient's preferred language from conversation data
        let targetLang = 'en' // Default fallback
        if (activeConversation.user_a_id === recipientId) {
          // Recipient is user_a, get their preferred language
          targetLang = activeConversation.user_a?.preferred_lang || 'en'
        } else if (activeConversation.user_b_id === recipientId) {
          // Recipient is user_b, get their preferred language  
          targetLang = activeConversation.user_b?.preferred_lang || 'en'
        }
        
        console.log(`Translation: ${user.name} (${detectedLang}) → Recipient ${recipientId} (${targetLang})`)

        // Add message to local state immediately (optimistic update)
        const tempMessage: Message = {
          id: `temp-${Date.now()}`,
          sender_id: user.id,
          sender_name: user.name,
          sender_role: user.role,
          text_source: transcribedText,
          text_translated: null, // Sender sees original text only
          source_lang: detectedLang,
          target_lang: targetLang,
          status: 'sent',
          created_at: new Date().toISOString(),
          duration
        }

        setMessages(prev => [...prev, tempMessage])

        // Generate TTS for the sent message (so user can replay it)
        generateTTSAudio(transcribedText, detectedLang, tempMessage.id, false, undefined, undefined)

        // Step 2: Send via WebSocket if connected, otherwise show demo mode
        let webSocketSent = false
        if (useWebSocketMode && isConnected) {
          const voiceNoteMessage = {
            type: 'voice_note',
            conversation_id: activeConversation.id,
            sender_id: user.id,
            text_source: transcribedText,
            source_lang: detectedLang,
            target_lang: targetLang,
            client_sent_at: new Date().toISOString()
          }
          
          console.log('Sending voice note via WebSocket:', voiceNoteMessage)
          webSocketSent = sendWebSocketMessage(voiceNoteMessage)
          
          if (!webSocketSent) {
            console.log('WebSocket send failed, falling back to demo mode')
            // Don't throw error, just fall back to demo mode
            // throw new Error('Failed to send message via WebSocket')
          }
        }

        // Always run demo mode as fallback or primary mode
        if (!useWebSocketMode || !isConnected || !webSocketSent) {
          // Demo mode - simulate translation and response
          console.log('Running in demo mode (no WebSocket)')
          
          // Simulate translation
          setTimeout(async () => {
            try {
              // Use our backend translation API instead of LibreTranslate directly
              const translateResponse = await fetch('/api/v1/capabilities/translate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: transcribedText,
                  source: detectedLang,
                  target: targetLang
                })
              })

              if (translateResponse.ok) {
                const translateResult = await translateResponse.json()
                
                if (translateResult.error) {
                  console.error('Translation error:', translateResult.error)
                  // Fallback to original text if translation fails (sender still sees original)
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === tempMessage.id 
                        ? { ...msg, text_translated: null, status: 'delivered' as const } // Sender sees original text only
                        : msg
                    )
                  )
                } else {
                  const translatedText = translateResult.translatedText

                  // Update the message with translation (but sender still sees original text)
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === tempMessage.id 
                        ? { ...msg, text_translated: null, status: 'delivered' as const } // Sender sees original text only
                        : msg
                    )
                  )

                  // Generate TTS for the translated message
                  await generateTTSAudio(translatedText, targetLang, tempMessage.id, true, undefined, undefined)
                }
              } else {
                console.error('Translation API failed:', translateResponse.status)
                // Fallback to original text (sender still sees original)
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === tempMessage.id 
                      ? { ...msg, text_translated: null, status: 'delivered' as const } // Sender sees original text only
                      : msg
                  )
                )
              }
            } catch (err) {
              console.error('Translation failed:', err)
            }
          }, 1000)
        }
      } else {
        // No speech detected
        setError('No speech detected. Please try again.')
      }

    } catch (error) {
      console.error('Failed to process voice message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send voice message')
    } finally {
      clearTimeout(transcribingTimeout)
      isTranscribingRef.current = false
      setIsTranscribing(false)
    }
  }, [user, activeConversation, useWebSocketMode, isConnected, sendWebSocketMessage])

  const handlePlayAudio = (audioUrl: string, messageId: string) => {
    if (audioUrl === 'generate') {
      // Generate TTS for this message
      const message = messages.find(msg => msg.id === messageId)
      if (message) {
        // For sender's own message, use original text and source language
        if (user && message.sender_id === user.id) {
          generateTTSAudio(message.text_source, message.source_lang, messageId, true, undefined, undefined)
        } else {
          // For recipient, use translated text and target language
          const textToSpeak = message.text_translated || message.text_source
          const targetLang = message.target_lang
          generateTTSAudio(textToSpeak, targetLang, messageId, true, undefined, undefined)
        }
      }
    } else {
      // Play existing audio
      playAudioFromUrl(audioUrl, messageId)
    }
  }

  const handleMarkAsPlayed = (messageId: string) => {
    // Update message status to played
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, status: 'played' as const } : msg
    ))
    
    // Send played status via WebSocket
    if (useWebSocketMode && isConnected) {
      const playedMessage = {
        type: 'played',
        message_id: messageId
      }
      console.log('Sending played status:', playedMessage)
      sendWebSocketMessage(playedMessage)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('voicecare_token')
    localStorage.removeItem('voicecare_user')
    router.push('/')
  }

  const getOtherParticipant = (conversation: Conversation) => {
    if (!user) return null
    
    return {
      id: conversation.user_a_id === user.id ? conversation.user_b_id : conversation.user_a_id,
      name: conversation.user_a_id === user.id ? conversation.user_b_name : conversation.user_a_name
    }
  }

  const toggleWebSocketMode = () => {
    setUseWebSocketMode(!useWebSocketMode)
    setError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const connectionStatus = useWebSocketMode 
    ? (isConnected ? 'Online' : isConnecting ? 'Connecting...' : 'Offline')
    : 'Demo Mode'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="glass-card border-b border-white/10 relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-white">
                Voice<span className="text-purple-300">Care</span>
              </Link>
              {activeConversation && (
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-300" />
                  <span className="text-white">
                    {getOtherParticipant(activeConversation)?.name}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {useWebSocketMode ? (
                  isConnected ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-400" />
                  )
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                )}
                <span className={`text-sm ${
                  useWebSocketMode 
                    ? (isConnected ? 'text-green-400' : 'text-red-400')
                    : 'text-yellow-400'
                }`}>
                  {connectionStatus}
                </span>
              </div>

              {/* WebSocket Toggle */}
              <button
                onClick={toggleWebSocketMode}
                className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
                title={useWebSocketMode ? 'Switch to Demo Mode' : 'Switch to Real-time Mode'}
              >
                {useWebSocketMode ? 'Real-time' : 'Demo'}
              </button>

              {/* Audio Toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-lg transition-colors ${
                  isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'
                }`}
                title={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                  user.role === 'admin' ? 'bg-red-500' :
                  user.role === 'nurse' ? 'bg-blue-500' : 'bg-green-500'
                }`}>
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="text-white">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-purple-200">{user.role}</div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="btn-secondary px-4 py-2 rounded-lg text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Messages Area */}
        <div className="flex-1 py-6 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Start Your Conversation
                </h3>
                <p className="text-purple-100 mb-6">
                  Press the microphone to record your voice message.
                  <br />
                  It will be automatically translated for your recipient.
                </p>
                <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 max-w-md mx-auto">
                  <div className="text-sm text-purple-100">
                    <strong>Your language:</strong> {user.preferred_lang.toUpperCase()}
                    <br />
                    <strong>Translation:</strong> Automatic
                    <br />
                    <strong>Voice:</strong> {(() => {
                      const prov = modelInfo?.tts?.provider || 'unknown'
                      if (prov === 'openai') {
                        const model = modelInfo?.tts?.model || 'tts-1'
                        const voice = modelInfo?.tts?.voice ? ` (${modelInfo.tts.voice})` : ''
                        return `OpenAI ${model}${voice}`
                      }
                      if (prov === 'elevenlabs') {
                        return 'ElevenLabs Premium'
                      }
                      if (prov === 'browser') {
                        return 'Browser TTS'
                      }
                      return 'Unknown'
                    })()}
                    <br />
                    <strong>Mode:</strong> {useWebSocketMode ? 'Real-time' : 'Demo'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={message.sender_id === user.id}
                  currentUserId={user.id}
                  onPlayAudio={handlePlayAudio}
                  onMarkAsPlayed={handleMarkAsPlayed}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error/Status Message */}
        {error && (
          <div className={`rounded-xl p-4 mb-4 ${
            error.includes('Demo mode') 
              ? 'bg-blue-500/20 border border-blue-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            <p className={error.includes('Demo mode') ? 'text-blue-300' : 'text-red-300'}>
              {error}
            </p>
          </div>
        )}

        {/* Recording Area */}
        <div className="py-6 border-t border-white/10">
          <div className="flex justify-center">
            {isTranscribing ? (
              <div className="flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
                <span className="text-white">Processing voice message...</span>
              </div>
            ) : (
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onRecordingStart={onRecordingStart}
                onRecordingStop={onRecordingStop}
                disabled={!activeConversation || isTranscribing}
                maxDuration={120}
              />
            )}
          </div>

          {/* Recording Instructions */}
          {!isRecording && !isTranscribing && (
            <div className="text-center mt-4">
              <p className="text-purple-100 text-sm">
                {useWebSocketMode 
                  ? (isConnected 
                      ? 'Press the microphone to start recording'
                      : 'WebSocket disconnected - using demo mode'
                    )
                  : 'Demo mode - STT and translation only'
                }
              </p>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-purple-300 hover:text-purple-200 text-sm underline mt-2 inline-block"
                >
                  Go to Admin Dashboard
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
