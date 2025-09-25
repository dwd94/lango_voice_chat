/**
 * Authentication service for managing user sessions and auth-related utilities
 */

export interface User {
  id: string;
  name: string;
  role: string;
  gender?: string;
  preferred_lang: string;
  preferred_voice?: string;
  created_at?: string;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export class AuthService {
  private readonly TOKEN_KEY = 'voicecare_token';
  private readonly USER_KEY = 'voicecare_user';
  
  /**
   * Get stored auth token
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  /**
   * Set auth token
   */
  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.TOKEN_KEY, token);
  }
  
  /**
   * Clear auth token
   */
  clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
  
  /**
   * Get current user from storage
   */
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  
  /**
   * Set current user in storage
   */
  setCurrentUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getCurrentUser();
  }
  
  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }
  
  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }
  
  /**
   * Login user (real API)
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const { apiClient } = await import('./api-client');
      const res = await apiClient.loginUser(email, password);
      if (!res.success || !res.data) {
        return { success: false, error: res.error || 'Invalid credentials' };
      }
      const { user, token } = res.data;
      this.setToken(token);
      this.setCurrentUser(user);
      return { success: true, user, token };
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  }
  
  /**
   * Register user (placeholder)
   */
  async register(userData: {
    name: string;
    role: string;
    preferred_lang: string;
    preferred_voice?: string;
    email: string;
    password: string;
  }): Promise<LoginResult> {
    try {
      const { apiClient } = await import('./api-client');
      const res = await apiClient.register(userData);
      if (!res.success || !res.data) {
        return { success: false, error: res.error || 'Registration failed' };
      }
      const { user, token } = res.data;
      this.setToken(token);
      this.setCurrentUser(user);
      return { success: true, user, token };
    } catch (e) {
      return { success: false, error: 'Registration failed' };
    }
  }
  
  /**
   * Logout user
   */
  logout(): void {
    this.clearToken();
  }
  
  /**
   * Refresh user data
   */
  async refreshUser(): Promise<User | null> {
    // In a real app, this would fetch fresh user data from API
    return this.getCurrentUser();
  }
}

// Utility functions

/**
 * Get language display name
 */
export function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic'
  };
  return languages[code] || code.toUpperCase();
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): Array<{code: string, name: string}> {
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' }
  ];
}

/**
 * Format user name
 */
export function formatUserName(user: User): string {
  return user.name || 'Unknown User';
}

/**
 * Get user initials
 */
export function getUserInitials(user: User): string {
  return user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get role color
 */
export function getRoleColor(role: string): string {
  switch (role.toLowerCase()) {
    case 'admin': return 'text-purple-400';
    case 'patient': return 'text-blue-400';
    case 'nurse': return 'text-green-400';
    default: return 'text-gray-400';
  }
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: string): string {
  switch (role.toLowerCase()) {
    case 'admin': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'patient': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'nurse': return 'bg-green-500/20 text-green-300 border-green-500/30';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // More than 1 day
  return date.toLocaleDateString();
}

/**
 * Format time
 */
export function formatTime(timestamp: string | Date): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Export singleton instance
export const authService = new AuthService(); 
