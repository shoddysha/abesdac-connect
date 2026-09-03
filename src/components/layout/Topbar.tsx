import { Menu, LogOut, User as UserIcon, ChevronDown, Settings, Lock, HelpCircle, Users, Calendar, TrendingUp, Church } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationsButton } from '@/components/NotificationsButton';
import { format } from 'date-fns';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch quick stats
  const { data: quickStats } = useQuery({
    queryKey: ['topbar-quick-stats'],
    queryFn: async () => {
      const [membersResult, eventsResult] = await Promise.all([
        supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('is_archived', false)
          .eq('status', 'active'),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .gte('start_date', new Date().toISOString().split('T')[0])
      ]);

      return {
        totalMembers: membersResult.count || 0,
        upcomingEvents: eventsResult.count || 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Close dropdown when clicking outside
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

  // Get user initials for avatar
  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  // Format current date
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Left: Mobile menu + Quick Stats */}
      <div className="flex items-center gap-3 flex-1">
        <button 
          onClick={onMenuClick} 
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        
        {/* Quick Stats */}
        <div className="hidden md:flex items-center gap-4">
          {/* Total Members */}
          <button
            onClick={() => navigate('/members')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-xs text-slate-500">Members</p>
              <p className="text-sm font-semibold text-slate-900">{quickStats?.totalMembers || 0}</p>
            </div>
          </button>

          {/* Upcoming Events */}
          <button
            onClick={() => navigate('/events')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 group-hover:bg-purple-200">
              <Calendar className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="text-xs text-slate-500">Upcoming</p>
              <p className="text-sm font-semibold text-slate-900">{quickStats?.upcomingEvents || 0}</p>
            </div>
          </button>

          {/* Church Logo/Name */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <Church className="h-4 w-4 text-slate-600" />
            </div>
            <div className="text-left">
              <p className="text-xs text-slate-500">Church</p>
              <p className="text-sm font-semibold text-slate-900">ABESDAC</p>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Date Display */}
      <div className="hidden lg:block text-center flex-shrink-0">
        <p className="text-sm font-medium text-slate-600">{currentDate}</p>
      </div>

      {/* Right: Notifications + User Profile */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        <NotificationsButton />
        
        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
          >
            {/* Avatar with initials */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
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
            
            {/* Name + Role (hidden on mobile) */}
            <div className="hidden lg:block text-left">
              <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
            </div>
            
            <ChevronDown className="h-4 w-4 text-slate-400 hidden lg:block" />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                <p className="text-xs text-slate-500 capitalize">{profile?.role.replace('_', ' ')}</p>
              </div>
              
              <button
                onClick={() => {
                  navigate('/settings');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" />
                Profile Settings
              </button>
              
              <button
                onClick={() => {
                  navigate('/settings');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Lock className="h-4 w-4" />
                Change Password
              </button>
              
              <button
                onClick={() => {
                  navigate('/help-support');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <HelpCircle className="h-4 w-4" />
                Help & Support
              </button>
              
              <div className="border-t border-slate-100 mt-2 pt-2">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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