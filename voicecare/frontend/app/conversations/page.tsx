'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authService } from '../auth'
import { 
  Users, 
  Plus, 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  ArrowRight, 
  Heart, 
  MessageCircle,
  Settings,
  LogOut
} from 'lucide-react'
import { apiClient } from '../api-client'
import dynamic from 'next/dynamic'

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

const ChatPage = dynamic(() => import('../chat/page'), {
  ssr: false,
  loading: () => null
})

export default function ConversationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const hasLoaded = useRef(false)
  const [isWsOnline, setIsWsOnline] = useState<boolean>(true)
  const sidebarRef = useRef<HTMLDivElement>(null)
  
  const conversationId = searchParams?.get('conversationId')

  useEffect(() => {
    const init = async () => {
      // Prevent multiple loads
      if (hasLoaded.current) return
      hasLoaded.current = true
      setLoading(true)
      
      try {
        console.log('Loading conversations data...')
        const current = authService.getCurrentUser()
        
        if (!current) {
          console.error('No user found in storage')
          setLoading(false)
          router.push('/auth/login')
          return
        }
        
        console.log('Loading data for user:', current)
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
            
            const otherUserId = conv.user_a_id === current.id ? conv.user_b_id : 
                               conv.user_b_id === current.id ? conv.user_a_id : null
                               
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
        console.error('Error fetching data:', e)
        setError('Failed to load conversations. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    init()
   
    return () => {
      hasLoaded.current = false
    }
  }, [router])


  useEffect(() => {
    if (conversationId) {
      // If we have a conversation ID in the URL, make sure it's loaded
      const loadConversation = async () => {
        try {
          const res = await apiClient.getConversations()
          if (res.success && res.data) {
            const allConversations = res.data as unknown as Conversation[]
            const conversation = allConversations.find(c => c.id === conversationId)
            
            if (conversation) {
              // The chat component will handle loading the messages
              // We just need to ensure the conversation is in our state
              setConversations(prev => {
                const exists = prev.some(c => c.id === conversationId)
                return exists ? prev : [conversation, ...prev]
              })
            }
          }
        } catch (error) {
          console.error('Error loading conversation:', error)
        }
      }
      
      loadConversation()
    }
  }, [conversationId])

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
      setShowNewChat(false) // Close the new chat dropdown
      const res = await apiClient.createOrGetConversation(user.id, other.id)
      if (!res.success || !res.data) throw new Error(res.error || 'Create failed')
      const c = res.data as unknown as Conversation
      
      // Create a new conversation object with user data
      // Make sure to assign users to the correct fields based on their IDs
      const newConversation: Conversation = {
        ...c,
        user_a: c.user_a_id === user.id ? user : other,
        user_b: c.user_b_id === user.id ? user : other
      }
      
      // Add the new conversation to the beginning of the conversations list
      setConversations(prevConversations => [newConversation, ...prevConversations])
      
      // Update the URL with the new conversation ID
      const params = new URLSearchParams()
      params.set('conversationId', c.id)
      router.push(`/conversations?${params.toString()}`, { scroll: false })
  
    } catch (e) {
      console.error('Failed to start chat:', e)
      setError('Failed to start chat')
    }
  }

  const openConversation = (c: Conversation) => {
    // Update the URL with the conversation ID as a query parameter
    const params = new URLSearchParams()
    params.set('conversationId', c.id)
    router.push(`/conversations?${params.toString()}`, { scroll: false })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">User not found</div>
          <button 
            onClick={() => router.push('/auth/login')} 
            className="text-sm text-primary hover:underline"
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  // Main content style that accounts for the sidebar width
  const mainContentStyle = {
    marginLeft: '320px',
    width: 'calc(100% - 320px)'
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left sidebar */}
      <div 
        ref={sidebarRef}
        className="fixed inset-y-0 left-0 z-30 w-80 flex flex-col bg-background border-r border-border/50"
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/50">
          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
            <div className="relative">
              <button
                onClick={() => setShowNewChat(v => !v)}
                className="p-1.5 rounded-full hover:bg-accent/50 text-foreground transition-colors"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              {showNewChat && (
                <div className="absolute right-0 mt-2 w-64 bg-background border border-border/50 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-1 space-y-1 max-h-64 overflow-auto">
                    {otherUsersWithNoConversation.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No users available</div>
                    ) : (
                      otherUsersWithNoConversation.map(u => (
                        <button
                          key={u.id}
                          onClick={() => startChatWith(u)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 rounded-md text-foreground flex items-center justify-between transition-colors"
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-accent/30 rounded-full">
                            {u.role.toLowerCase()}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* User profile */}
          <div className="mt-4 flex items-center space-x-3 p-2 rounded-lg bg-accent/20">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm bg-gradient-to-r from-primary to-accent text-white">
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
            <button
              onClick={() => { 
                authService.logout(); 
                router.push('/auth/login');
                router.refresh();
              }}
              className="p-1.5 rounded-full hover:bg-accent/50 text-foreground transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-destructive text-sm">
              <AlertCircle className="w-4 h-4 inline-block mr-1" />
              {error}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-sm font-medium text-foreground mb-1">No conversations yet</h3>
              <p className="text-xs text-muted-foreground">Start a new chat to begin a conversation</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {conversations.map(c => {
                const other = getOtherParticipant(c)
                const isActive = conversationId === c.id
                
                return (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c)}
                    className={`w-full text-left p-3 hover:bg-accent/30 transition-colors ${isActive ? 'bg-accent/20' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs bg-gradient-to-r from-primary to-accent text-white">
                        {other?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground truncate">{other?.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{other?.role}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>


      </div>

      {/* Main content */}
      <main 
        className="flex-1 flex flex-col bg-background/50 overflow-hidden"
        style={mainContentStyle}
      >
        {conversationId ? (
          <div className="flex-1 flex flex-col h-full">
            <ChatPage conversationId={conversationId} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Select a conversation</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Choose an existing conversation or start a new one to begin messaging.
            </p>
          </div>
        )}
      </main>
    </div>
  )
} 