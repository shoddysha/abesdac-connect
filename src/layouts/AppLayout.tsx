import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
