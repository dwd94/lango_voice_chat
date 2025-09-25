'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, Check, CheckCheck } from 'lucide-react'

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

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
  currentUserId: string
  onPlayAudio?: (audioUrl: string, messageId: string) => void
  onMarkAsPlayed?: (messageId: string) => void
}

export default function MessageBubble({
  message,
  isOwnMessage,
  currentUserId,
  onPlayAudio,
  onMarkAsPlayed
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying ] = useState(false)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Create audio element if audio URL is provided
    if (message.audio_url && !audioRef.current) {
      audioRef.current = new Audio(message.audio_url)
      
      audioRef.current.addEventListener('loadedmetadata', () => {
        // Audio loaded
      })
      
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100
          setPlaybackProgress(progress)
        }
      })
      
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        setPlaybackProgress(0)
        onMarkAsPlayed?.(message.id)
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [message.audio_url, message.id, onMarkAsPlayed])

  const handlePlayPause = async () => {
    if (!audioRef.current) {
      // If no audio element, try to play via parent component
      if (message.audio_url) {
        onPlayAudio?.(message.audio_url, message.id)
      }
      return
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (error) {
        console.error('Failed to play audio:', error)
      }
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    // Display time in UTC+5 (Asia/Karachi)
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Karachi',
    }).format(date)
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-400'
      case 'nurse': return 'text-blue-400'
      case 'patient': return 'text-green-400'
      default: return 'text-purple-400'
    }
  }

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />
      case 'played':
        return <CheckCheck className="w-4 h-4 text-blue-400" />
      default:
        return null
    }
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4 animate-slide-up`}>
      <div className={`
        max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-lg
        ${isOwnMessage 
          ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white ml-12' 
          : 'glass-card text-white mr-12'
        }
        transform transition-all duration-300 hover:scale-[1.02]
      `}>
        {/* Sender Info (for received messages) */}
        {!isOwnMessage && (
          <div className="flex items-center space-x-2 mb-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
              message.sender_role === 'admin' ? 'bg-red-500' :
              message.sender_role === 'nurse' ? 'bg-blue-500' : 'bg-green-500'
            }`}>
              {message.sender_name.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-sm font-medium">{message.sender_name}</span>
            <span className={`text-xs ${getRoleColor(message.sender_role)}`}>
              {message.sender_role}
            </span>
          </div>
        )}

        {/* Language Translation Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {isOwnMessage 
                ? message.source_lang.toUpperCase()  // Sender sees source language
                : message.target_lang.toUpperCase()  // Recipient sees target language
              }
            </span>
            
            {/* Speaker Icon - always show for translated messages */}
            <button
              onClick={() => {
                if (message.audio_url) {
                  onPlayAudio?.(message.audio_url, message.id)
                } else {
                  // Generate TTS if no audio URL exists yet
                  console.log('Generating TTS for message:', message.id)
                  // This will be handled by the parent component
                  onPlayAudio?.('generate', message.id)
                }
              }}
              className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              title={message.audio_url ? 'Play audio' : 'Generate and play audio'}
            >
              <Volume2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Audio Player (if audio available) */}
        {message.audio_url && (
          <div className="flex items-center space-x-3 mb-3 p-3 bg-white/10 rounded-xl">
            <button
              onClick={handlePlayPause}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>
            
            {/* Waveform/Progress Bar */}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4" />
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-100"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>
                <span className="text-xs">
                  {formatDuration(message.duration)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Message Text */}
        <div className="space-y-2">
          {/* For sender's own messages: show only original text */}
          {/* For received messages: show only translated text */}
          <div className="text-sm leading-relaxed">
            {isOwnMessage 
              ? message.text_source  // Sender sees original text
              : (message.text_translated || message.text_source)  // Recipient sees translated text
            }
          </div>
        </div>

        {/* Message Footer */}
        <div className={`flex items-center justify-between mt-2 text-xs ${
          isOwnMessage ? 'text-purple-200' : 'text-purple-300'
        }`}>
          <span>{formatTime(message.created_at)}</span>
          {isOwnMessage && (
            <div className="flex items-center space-x-1">
              {getStatusIcon()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
