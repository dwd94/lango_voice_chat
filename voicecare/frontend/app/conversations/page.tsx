"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { apiClient } from '../api-client'
import { authService } from '../auth'

interface User {
  id: string
  name: string
  role: string
  preferred_lang: string
}

interface Conversation {
  id: string
  user_a_id: string
  user_b_id: string
  created_at: string
  user_a?: User
  user_b?: User
}

export default function ConversationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const hasLoaded = useRef(false)

  // Simple online indicator matches chat header styles (no WS join required here)
  const [isWsOnline, setIsWsOnline] = useState<boolean>(true)

  useEffect(() => {
    const init = async () => {
      // Prevent multiple loads
      if (hasLoaded.current) return
      hasLoaded.current = true
      
      try {
        const current = authService.getCurrentUser()
        const token = authService.getToken()
        if (!current || !token) {
          router.push('/auth/login')
          return
        }
        setUser(current)

        const [usersRes, convRes] = await Promise.all([
          apiClient.getUsers(),
          apiClient.getConversations(),
        ])
        
        console.log('Raw conversations response:', convRes)

        if (usersRes.success && usersRes.data) {
          setUsers(usersRes.data as unknown as User[])
        }

        if (convRes.success && convRes.data) {
          const all = convRes.data as unknown as Conversation[]
          console.log('All conversations from API:', all)
          
          const conversationMap = new Map<string, Conversation>()
          
          all.forEach(conv => {
            if (conv.user_a_id !== current.id && conv.user_b_id !== current.id) {
              return
            }
            
            if (!conv.user_a || !conv.user_b) {
              console.warn('Conversation missing user data:', conv)
              return
            }
            
            const otherUserId = conv.user_a_id === current.id ? conv.user_b_id : conv.user_a_id
            
            const key = [current.id, otherUserId].sort().join('_')
            
            const existing = conversationMap.get(key)
            if (!existing || new Date(conv.created_at) > new Date(existing.created_at)) {
              conversationMap.set(key, conv)
            }
          })
          
          const finalList = Array.from(conversationMap.values())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          
          console.log('Final deduplicated conversations:', finalList)
          setConversations(finalList)
        }
      } catch (e) {
        console.error('Error loading conversations:', e)
        setError('Failed to load conversations')
      } finally {
        setLoading(false)
      }
    }
    
    init()
    
    // Cleanup function
    return () => {
      hasLoaded.current = false
    }
  }, [router])

  const otherUsersWithNoConversation = useMemo(() => {
    if (!user) return [] as User[]
    
    // Get all user IDs the current user has already chatted with
    const alreadyChattedIds = new Set<string>()
    conversations.forEach(c => {
      if (c.user_a_id === user.id) {
        alreadyChattedIds.add(c.user_b_id)
      } else if (c.user_b_id === user.id) {
        alreadyChattedIds.add(c.user_a_id)
      }
    })
    
    // Filter out the current user and users already chatted with
    return (users || []).filter(u => 
      u.id !== user.id && !alreadyChattedIds.has(u.id)
    )
  }, [users, conversations, user])

  const getOtherParticipant = (c: Conversation) => {
    if (!user) return null
    
    // Determine which user is the other participant
    const otherUser = c.user_a_id === user.id ? c.user_b : 
                     c.user_b_id === user.id ? c.user_a : null
                     
    const otherId = c.user_a_id === user.id ? c.user_b_id : 
                   c.user_b_id === user.id ? c.user_a_id : null
                   
    if (!otherUser || !otherId) {
      console.warn('Could not determine other participant for conversation:', c)
      return { id: 'unknown', name: 'Unknown User' }
    }
    
    return { 
      id: otherId, 
      name: otherUser.name || 'Unknown User',
      role: otherUser.role,
      preferred_lang: otherUser.preferred_lang
    }
  }

  const startChatWith = async (other: User) => {
    if (!user) return
    try {
      const res = await apiClient.createOrGetConversation(user.id, other.id)
      if (!res.success || !res.data) throw new Error(res.error || 'Create failed')
      const c = res.data as unknown as Conversation
      // Use query parameter for consistency
      router.push(`/chat?conversationId=${c.id}`)
    } catch (e) {
      setError('Failed to start chat')
    }
  }

  const openConversation = (c: Conversation) => {
    // Navigate to /chat with the conversation ID as a query parameter
    router.push(`/chat?conversationId=${c.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    )
  }

  if (!user) return null

  // Compute container classes to avoid overlap with New Chat dropdown
  const listContainerClass = showNewChat
    ? "flex-1 max-w-3xl w-full px-4 sm:px-6 lg:px-8 py-6 ml-4 mr-[320px]"
    : "flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6"

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header (reuse style parity with chat) */}
      <div className="glass-card border-b border-white/10 relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-white">
                Voice<span className="text-purple-300">Care</span>
              </Link>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-300" />
                <span className="text-white">Conversations</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isWsOnline ? (
                  <Wifi className="w-5 h-5 text-green-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400" />
                )}
                <span className={`text-sm ${isWsOnline ? 'text-green-400' : 'text-red-400'}`}>
                  {isWsOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* New Chat */}
              <div className="relative">
                <button
                  onClick={() => setShowNewChat(v => !v)}
                  className="text-xs bg-green-500/20 hover:bg-green-500/30 px-2 py-1 rounded text-green-300 ml-2 flex items-center gap-1"
                  title="Start New Chat"
                >
                  <Plus className="w-3 h-3" /> New Chat
                </button>
                {showNewChat && (
                  <div className="absolute top-full right-0 mt-2 bg-navy-900/95 backdrop-blur border border-indigo-500/30 rounded-lg shadow-lg z-[9999] min-w-[260px]">
                    <div className="p-2 space-y-1 max-h-80 overflow-auto">
                      {otherUsersWithNoConversation.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-purple-200">No users available</div>
                      ) : (
                        otherUsersWithNoConversation.map(u => (
                          <button
                            key={u.id}
                            onClick={() => startChatWith(u)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded text-white flex items-center justify-between"
                          >
                            <span>{u.name}</span>
                            <span className="text-xs text-purple-200 capitalize">{u.role}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Info */}
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
                onClick={() => { authService.logout(); router.push('/') }}
                className="btn-secondary px-4 py-2 rounded-lg text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={listContainerClass}>
        {error && (
          <div className="rounded-xl p-4 mb-4 bg-red-500/20 border border-red-500/30 text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-white mb-2">No conversations yet</h3>
            <p className="text-purple-100 mb-6">Start a new chat to begin a conversation.</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="btn-primary px-6 py-3 rounded-xl text-white"
            >
              Start New Chat
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => {
              const other = getOtherParticipant(c)
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c)}
                  className="w-full flex items-center justify-between p-4 glass-card rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold">
                      {other?.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">{other?.name}</div>
                      <div className="text-xs text-purple-200">Started {new Date(c.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-xs text-purple-200">Open</div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
} 