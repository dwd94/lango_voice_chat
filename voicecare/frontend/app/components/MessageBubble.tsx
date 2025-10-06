'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, Check, CheckCheck } from 'lucide-react'

interface Message {
  id: string
  sender_id: string
  sender_name: string
  sender_role: string
  sender_gender?: string
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
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
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
      case 'admin': return 'text-red-600'
      case 'nurse': return 'text-blue-600'
      case 'patient': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-500" />
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-500" />
      case 'played':
        return <CheckCheck className="w-4 h-4 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4 px-4`}>
      <div className={`
        max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm
        ${isOwnMessage 
          ? 'bg-gradient-to-r from-primary to-primary/90 text-white ml-12' 
          : 'bg-background text-foreground border border-border/50 mr-12'
        }
        transform transition-all duration-200 hover:shadow-md
      `}>
        {/* Sender Info */}
        {!isOwnMessage && (
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-r from-primary to-accent">
              {message.sender_name ? 
                message.sender_name.split(' ').map(n => n[0]).join('').toUpperCase() : 
                '?'}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">{message.sender_name || 'Unknown User'}</span>
              <span className={`text-xs bg-accent/20 text-foreground/80 px-2 py-0.5 rounded-full`}>
                {message.sender_role.charAt(0).toUpperCase() + message.sender_role.slice(1)}
              </span>
            </div>
          </div>
        )}

        {/* Language & Audio Controls */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isOwnMessage 
                ? 'bg-white/20 text-white/90' 
                : 'bg-accent/20 text-foreground/80'
            }`}>
              {isOwnMessage 
                ? message.source_lang.toUpperCase()
                : message.target_lang.toUpperCase()
              }
            </span>
            
            {/* Speaker Icon */}
            <button
              onClick={() => {
                if (message.audio_url) {
                  onPlayAudio?.(message.audio_url, message.id)
                } else {
                  onPlayAudio?.('generate', message.id)
                }
              }}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                isOwnMessage 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-accent/20 hover:bg-accent/30'
              }`}
              title={message.audio_url ? 'Play audio' : 'Generate and play audio'}
            >
              <Volume2 className={`w-3 h-3 ${isOwnMessage ? 'text-white' : 'text-foreground'}`} />
            </button>
          </div>
        </div>

        {/* Audio Player (if audio available) */}
        {message.audio_url && (
          <div className={`flex items-center space-x-3 mb-3 p-3 rounded-xl ${
            isOwnMessage ? 'bg-white/10' : 'bg-accent/10'
          }`}>
            <button
              onClick={handlePlayPause}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isOwnMessage 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-accent/20 hover:bg-accent/30'
              }`}
            >
              {isPlaying ? (
                <Pause className={`w-4 h-4 ${isOwnMessage ? 'text-white' : 'text-foreground'}`} />
              ) : (
                <Play className={`w-4 h-4 ${isOwnMessage ? 'text-white' : 'text-foreground'}`} />
              )}
            </button>

            {/* Progress Bar */}
            <div className="flex-1">
              <div className={`h-1.5 rounded-full overflow-hidden ${
                isOwnMessage ? 'bg-white/30' : 'bg-accent/20'
              }`}>
                <div 
                  className={`h-full ${
                    isOwnMessage ? 'bg-white' : 'bg-primary'
                  }`}
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {formatDuration(audioRef.current?.currentTime || 0)}
                </span>
                <span className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {formatDuration(audioRef.current?.duration || message.duration)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Message Text */}
        <div className={`mb-2 ${isOwnMessage ? 'text-white' : 'text-foreground'}`}>
          <p className="text-sm">
            {isOwnMessage ? message.text_source : (message.text_translated || message.text_source)}
          </p>
        </div>

        {/* Timestamp and Status */}
        <div className={`flex items-center justify-end mt-2 pt-2 ${isOwnMessage ? 'border-t border-white/20' : 'border-t border-border/30'}`}>
          <div className="flex items-center space-x-2">
            {isOwnMessage && getStatusIcon()}
            <span className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-muted-foreground'}`}>
              {formatTime(message.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
