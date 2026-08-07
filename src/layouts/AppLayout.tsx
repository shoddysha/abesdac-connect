import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { NotificationBanner } from '@/components/NotificationBanner';
import { useIdleLogout } from '@/hooks/useIdleLogout';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useIdleLogout();

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/30 lg:hidden" 
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          <div className="mx-auto max-w-7xl">
            <NotificationBanner />
            <div className="mt-4">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}