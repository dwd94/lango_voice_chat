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
  const [inputText, setInputText] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [isPlaying, setIsPlaying] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/ws')
    
    ws.onopen = () => {
      setIsConnected(true)
      console.log('Connected to WebSocket')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'translation') {
        const newMessage: Message = {
          id: data.data.message_id,
          text: inputText,
          translated_text: data.data.translated_text,
          audio_url: data.data.audio_url,
          is_sender: true,
          timestamp: new Date().toLocaleTimeString()
        }
        
        setMessages(prev => [...prev, newMessage])
        setInputText('')
      } else if (data.type === 'error') {
        console.error('Translation error:', data.message)
        alert(`Translation error: ${data.message}`)
      }
    }
    
    ws.onclose = () => {
      setIsConnected(false)
      console.log('Disconnected from WebSocket')
      // Try to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }
    
    wsRef.current = ws
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = () => {
    if (!inputText.trim() || !wsRef.current || !isConnected) return

    const message = {
      text: inputText,
      source_lang: sourceLang,
      target_lang: targetLang,
      sender_id: 'user1'
    }

    wsRef.current.send(JSON.stringify(message))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    
    // For demo purposes, we'll just show a message since we don't have actual audio files
    setIsPlaying(true)
    setTimeout(() => setIsPlaying(false), 2000)
    console.log('Playing audio:', audioUrl)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Simple Voice Chat</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
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
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
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
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
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
              <p>Start a conversation by typing a message below</p>
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

      {/* Input */}
      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                disabled={!isConnected}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || !isConnected}
              className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`p-2 rounded-lg ${
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </div>
  )
}
