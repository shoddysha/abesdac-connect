import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, Settings, Lock, HelpCircle, LogOut, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationsButton } from '@/components/NotificationsButton';
import { format } from 'date-fns';

// Map routes to readable breadcrumb labels
const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/members': 'Members',
  '/ministries': 'Ministries',
  '/attendance': 'Attendance',
  '/events': 'Events',
  '/reports': 'Reports',
  '/announcements': 'Announcements',
  '/visitors': 'Visitors',
  '/prayer-requests': 'Prayer Requests',
  '/leaders': 'Leaders',
  '/member-followup': 'Member Follow-up',
  '/submit-ministry-report': 'Submit Report',
  '/all-member-followups': 'Member Follow-ups',
  '/all-ministry-reports': 'Ministry Reports',
  '/resources': 'Resources',
  '/sms': 'SMS & Notifications',
  '/users': 'User Management',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
  '/help-support': 'Help & Support',
  '/ministry-dashboard': 'My Ministry',
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  // Build breadcrumb from current path
  const currentPath = location.pathname;
  const currentLabel = routeLabels[currentPath] || 'Dashboard';
  const isHome = currentPath === '/';

  // User initials for avatar
  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  // Current term / date info
  const currentDate = format(new Date(), 'yyyy');

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">

      {/* Left: Mobile menu + Breadcrumb */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav className="hidden sm:flex items-center gap-1.5 text-sm">
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            ABESDAC Connect
          </button>
          {!isHome && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900">{currentLabel}</span>
            </>
          )}
        </nav>

        {/* Mobile: just show current page */}
        <span className="sm:hidden text-sm font-semibold text-slate-900">{currentLabel}</span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search anything..."
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Term pill + Notifications + User */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">

        {/* Term indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
          <span className="h-2 w-2 rounded-full bg-green-500"></span>
          {currentDate}
        </div>

        {/* Notifications */}
        <NotificationsButton />

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
          >
            {/* Avatar */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                initials
              )}
            </div>

            {/* Name + role */}
            <div className="hidden lg:block text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {profile?.full_name?.split(' ')[0]} {profile?.full_name?.split(' ').slice(-1)[0]}
              </p>
              <p className="text-[11px] text-slate-500 capitalize leading-tight">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>

            <ChevronDown className="h-4 w-4 text-slate-400 hidden lg:block" />
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-lg border border-slate-200 py-2 z-50">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{profile?.full_name}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{profile?.role?.replace('_', ' ')}</p>
              </div>

              <button
                onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                Profile Settings
              </button>

              <button
                onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Lock className="h-4 w-4 text-slate-400" />
                Change Password
              </button>

              <button
                onClick={() => { navigate('/help-support'); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <HelpCircle className="h-4 w-4 text-slate-400" />
                Help & Support
              </button>

              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
