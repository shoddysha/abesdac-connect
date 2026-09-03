import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  ClipboardCheck,
  CalendarDays,
  BarChart3,
  Megaphone,
  UserPlus2,
  HandHeart,
  MessageSquare,
  UserCog,
  Settings,
  UsersRound,
  Shield,
  Briefcase,
  FileBarChart,
  Heart,
  Video,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { cn } from '@/utils/cn';
import type { UserRole } from '@/types/database';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/ministry-dashboard', label: 'My Ministry', icon: Briefcase, roles: ['ministry_leader'] },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/ministries', label: 'Ministries', icon: HeartHandshake },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['administrator', 'pastor'] },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/visitors', label: 'Visitors', icon: UserPlus2, roles: ['administrator', 'secretary', 'ministry_leader'] },
  { to: '/prayer-requests', label: 'Prayer Requests', icon: HandHeart, roles: ['administrator', 'pastor', 'secretary'] },
  { to: '/leaders', label: 'Leaders', icon: UsersRound, roles: ['administrator', 'pastor', 'ministry_leader', 'secretary'] },
  { to: '/member-followup', label: 'Member Follow-up', icon: Heart, roles: ['ministry_leader'] },
  { to: '/submit-ministry-report', label: 'Submit Reports', icon: FileBarChart, roles: ['ministry_leader'] },
  { to: '/all-member-followups', label: 'Member Follow-ups', icon: Heart, roles: ['administrator', 'secretary'] },
  { to: '/all-ministry-reports', label: 'Ministry Reports', icon: FileBarChart, roles: ['administrator', 'secretary'] },
  { to: '/resources', label: 'Resources', icon: Video, roles: ['administrator', 'secretary', 'ministry_leader'] },
  { to: '/sms', label: 'SMS & Notifications', icon: MessageSquare, roles: ['administrator', 'secretary'] },
  { to: '/users', label: 'User Management', icon: UserCog, roles: ['administrator'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: Shield, roles: ['administrator', 'secretary'] },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate: () => void }) {
  const { profile } = useAuth();
  const { data: notificationCounts } = useNotificationCounts();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getNotificationCount = (path: string): number => {
    if (!notificationCounts) return 0;
    
    switch (path) {
      case '/all-ministry-reports':
        return notificationCounts.ministryReports;
      case '/all-member-followups':
        return notificationCounts.memberFollowUps;
      case '/announcements':
        return notificationCounts.announcements;
      default:
        return 0;
    }
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-primary text-white transition-all duration-300 lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-16 shrink-0 items-center border-b border-white/10 px-5 transition-all",
        isCollapsed ? 'justify-center px-2' : 'justify-between gap-2'
      )}>
        {isCollapsed ? (
          <img src="/abeka.png" alt="Logo" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1" />
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img src="/abeka.png" alt="Abeka SDA Church logo" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1" />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">ABESDAC_Connect</p>
                <p className="text-[11px] leading-tight text-white/60 truncate">Abeka SDA Church</p>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="hidden lg:flex h-6 w-6 items-center justify-center rounded hover:bg-white/10 transition-colors shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
        
        {/* Collapsed expand button */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="hidden lg:block absolute right-0 top-5 h-6 w-6 rounded-l bg-primary hover:bg-primary/90 transition-colors translate-x-full border border-white/10 border-r-0"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4 mx-auto" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          {navItems
            .filter((item) => !item.roles || (profile && item.roles.includes(profile.role)))
            .map((item) => {
              const count = getNotificationCount(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative group',
                      isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                      isCollapsed && 'justify-center px-2'
                    )
                  }
                >
                  <item.icon className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4.5 w-4.5")} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shrink-0">
                          {count}
                        </span>
                      )}
                    </>
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="hidden group-hover:block absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
                      {item.label}
                      {count > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 inline-flex items-center justify-center">
                          {count}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Notification badge for collapsed state */}
                  {isCollapsed && count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </NavLink>
              );
            })}
        </div>
      </nav>
    </aside>
  );
}
