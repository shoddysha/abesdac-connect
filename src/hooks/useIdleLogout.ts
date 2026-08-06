import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_IDLE_TIMEOUT_MINUTES = 15;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
const RESET_THROTTLE_MS = 1000; // don't restart the timer more than once/second

/**
 * Signs the user out automatically after configured minutes of no activity
 * (mouse, keyboard, touch, or scroll). Used in AppLayout.tsx so it only
 * runs while someone is actually inside the signed-in app — not on the
 * public login or QR check-in pages.
 *
 * Timeout duration is configurable in Settings page.
 */
export function useIdleLogout() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef(0);

  useEffect(() => {
    if (!session) return; // nothing to time out if no one is signed in

    // Read timeout from localStorage (default 15 minutes)
    const savedTimeout = localStorage.getItem('idle_timeout_minutes');
    const timeoutMinutes = savedTimeout ? parseInt(savedTimeout) : DEFAULT_IDLE_TIMEOUT_MINUTES;
    const IDLE_TIMEOUT_MS = timeoutMinutes * 60 * 1000;

    async function handleTimeout() {
      await signOut();
      toast.error("You've been signed out due to inactivity.");
      navigate('/login');
    }

    function resetTimer() {
      const now = Date.now();
      if (now - lastResetRef.current < RESET_THROTTLE_MS) return; // avoid resetting on every single mousemove
      lastResetRef.current = now;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(handleTimeout, IDLE_TIMEOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [session, signOut, navigate]);
}