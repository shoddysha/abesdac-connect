import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, Settings, Lock, HelpCircle, LogOut, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationsButton } from '@/components/NotificationsButton';
import { format } from 'date-fns';

// Map routes to breadcrumb labels
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

// All searchable pages
const SEARCHABLE = [
  { label: 'Dashboard', path: '/', keywords: 'home overview' },
  { label: 'Members', path: '/members', keywords: 'people church register' },
  { label: 'Ministries', path: '/ministries', keywords: 'groups teams departments' },
  { label: 'Attendance', path: '/attendance', keywords: 'checkin service records' },
  { label: 'Events', path: '/events', keywords: 'calendar schedule program' },
  { label: 'Reports', path: '/reports', keywords: 'analytics statistics data' },
  { label: 'Announcements', path: '/announcements', keywords: 'news broadcast message' },
  { label: 'Visitors', path: '/visitors', keywords: 'guests new first time' },
  { label: 'Prayer Requests', path: '/prayer-requests', keywords: 'pray intercession' },
  { label: 'Leaders', path: '/leaders', keywords: 'pastors elders executives' },
  { label: 'Resources', path: '/resources', keywords: 'files documents sermons videos' },
  { label: 'SMS & Notifications', path: '/sms', keywords: 'messages text send bulk' },
  { label: 'User Management', path: '/users', keywords: 'accounts roles admin permissions' },
  { label: 'Audit Logs', path: '/audit-logs', keywords: 'security activity tracking' },
  { label: 'Settings', path: '/settings', keywords: 'preferences profile password' },
  { label: 'Help & Support', path: '/help-support', keywords: 'faq guide docs tutorials' },
];

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<typeof SEARCHABLE>([]);
  const [showResults, setShowResults] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter pages by search query
  useEffect(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) { setSearchResults([]); setShowResults(false); return; }
    const hits = SEARCHABLE.filter(r =>
      r.label.toLowerCase().includes(q) || r.keywords.includes(q)
    );
    setSearchResults(hits);
    setShowResults(true);
  }, [searchValue]);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setSearchValue('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  function handleSearchSelect(path: string) {
    navigate(path);
    setSearchValue('');
    setShowResults(false);
  }

  // Breadcrumb
  const currentPath = location.pathname;
  const currentLabel = routeLabels[currentPath] || 'Dashboard';
  const isHome = currentPath === '/';

  // User initials
  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  // Today's date — changes automatically each day
  const todayLabel = format(new Date(), 'EEE, MMM d, yyyy');

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">

      {/* LEFT — mobile menu + breadcrumb */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav className="hidden sm:flex items-center gap-1.5 text-sm">
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
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
        <span className="sm:hidden text-sm font-semibold text-slate-900">{currentLabel}</span>
      </div>

      {/* CENTER — search (shorter, max-w-xs) */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-xs" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onFocus={() => searchValue && setShowResults(true)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
              {searchResults.map(r => (
                <button
                  key={r.path}
                  onClick={() => handleSearchSelect(r.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                >
                  <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {showResults && searchValue && searchResults.length === 0 && (
            <div className="absolute top-full mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-lg z-50 px-4 py-3 text-sm text-slate-400">
              No pages found for "{searchValue}"
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — date pill + notifications + user */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Today's full date — auto-updates each day */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0"></span>
          {todayLabel}
        </div>

        <NotificationsButton />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {profile?.full_name?.split(' ').slice(0, 2).join(' ')}
              </p>
              <p className="text-[11px] text-slate-500 capitalize leading-tight">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 hidden lg:block" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-lg border border-slate-200 py-2 z-50">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{profile?.full_name}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <button onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <Settings className="h-4 w-4 text-slate-400" /> Profile Settings
              </button>
              <button onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <Lock className="h-4 w-4 text-slate-400" /> Change Password
              </button>
              <button onClick={() => { navigate('/help-support'); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <HelpCircle className="h-4 w-4 text-slate-400" /> Help & Support
              </button>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
