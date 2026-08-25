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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
  { to: '/sms', label: 'SMS', icon: MessageSquare, roles: ['administrator', 'secretary'] },
  { to: '/users', label: 'User Management', icon: UserCog, roles: ['administrator'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: Shield, roles: ['administrator', 'secretary'] },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate: () => void }) {
  const { profile } = useAuth();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary text-white transition-transform duration-300 lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-5">
        <img src="/abeka.png" alt="Abeka SDA Church logo" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1" />
        <div>
          <p className="text-sm font-bold leading-tight">ABESDAC_Connect</p>
          <p className="text-[11px] leading-tight text-white/60">Abeka SDA Church</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          {navItems
            .filter((item) => !item.roles || (profile && item.roles.includes(profile.role)))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </NavLink>
            ))}
        </div>
      </nav>
    </aside>
  );
}