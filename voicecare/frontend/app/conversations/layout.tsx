'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../auth';

// Debug function to log all localStorage items
const logLocalStorage = () => {
  if (typeof window === 'undefined') return;
  console.log('Current localStorage state:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      console.log(`${key}:`, localStorage.getItem(key));
    }
  }
};

export default function ConversationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    console.log('Layout - Component mounted, checking authentication...');
    console.log('Current path:', window.location.pathname);
    logLocalStorage(); // Log current localStorage state

    // Check auth status
    const checkAuth = () => {
      try {
        const user = authService.getCurrentUser();
        const token = authService.getToken();
        
        console.log('Layout - Authentication check:', { 
          userExists: !!user,
          tokenExists: !!token,
          user: user,
          token: token ? '***' + token.slice(-10) : null, // Log partial token for debugging
          timestamp: new Date().toISOString() 
        });
        
        if (!user || !token) {
          console.log('Layout - Not authenticated, will redirect to login');
          return false;
        } else {
          console.log('Layout - User authenticated:', user);
          return true;
        }
      } catch (error) {
        console.error('Layout - Error checking authentication:', error);
        return false;
      }
    };

    // Initial check
    const isAuthed = checkAuth();
    
    if (!isAuthed) {
      console.log('Layout - Not authenticated, redirecting to login');
      // Clear any potentially invalid auth data
      authService.clearToken();
      // Use window.location to ensure we leave the current page
      window.location.href = '/auth/login';
      return;
    }

    // If we get here, we're authenticated
    setIsAuthenticated(true);

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      console.log('Storage event:', e.key, e.newValue);
      if (e.key === authService.TOKEN_KEY || e.key === authService.USER_KEY) {
        console.log('Layout - Auth-related storage changed, rechecking auth');
        if (!checkAuth()) {
          authService.clearToken();
          window.location.href = '/auth/login';
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [router]);

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, don't render anything (will be redirected by the effect)
  if (!isAuthenticated) {
    return null;
  }

  // If authenticated, render the children
  return (
    <div className=" bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800">
      {children}
    </div>
  );
}
