import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-card px-4 sm:px-6">
      <button onClick={onMenuClick} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-ink">{profile?.full_name}</p>
          <p className="text-xs capitalize text-slate-500">{profile?.role.replace('_', ' ')}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary">
          <UserIcon className="h-4 w-4" />
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
