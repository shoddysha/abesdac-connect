import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserCog, Info, UserPlus, Users as UsersIcon, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchProfiles, updateProfileRole, setProfileActive } from '@/services/users';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { AddUserModal } from '@/features/users/AddUserModal';
import type { UserRole } from '@/types/database';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'ministry_leader', label: 'Ministry leader' },
];

export function Users() {
  const { profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  
  const query = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });
  useRealtimeQuery('profiles', ['profiles']);

  async function handleRoleChange(id: string, role: UserRole) {
    try {
      await updateProfileRole(id, role);
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    await setProfileActive(id, !isActive);
    toast.success(!isActive ? 'Account enabled' : 'Account disabled');
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
  }

  const users = query.data ?? [];
  const filteredUsers = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter);
  
  // Get stats
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
  };

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getAvatarColor(role: UserRole) {
    const colors = {
      administrator: 'bg-red-500',
      secretary: 'bg-blue-500',
      pastor: 'bg-purple-500',
      ministry_leader: 'bg-green-500',
    };
    return colors[role] || 'bg-slate-500';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage users, roles and permissions</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Users</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <UsersIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.active}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Inactive</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.inactive}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <UserX className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Role Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {[
          { value: 'all', label: 'All Users', count: stats.total },
          { value: 'administrator', label: 'Administrators', count: users.filter(u => u.role === 'administrator').length },
          { value: 'secretary', label: 'Secretaries', count: users.filter(u => u.role === 'secretary').length },
          { value: 'pastor', label: 'Pastors', count: users.filter(u => u.role === 'pastor').length },
          { value: 'ministry_leader', label: 'Ministry Leaders', count: users.filter(u => u.role === 'ministry_leader').length },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setRoleFilter(tab.value as UserRole | 'all')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              roleFilter === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              roleFilter === tab.value ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Users Grid */}
      {query.isLoading ? (
        <Spinner />
      ) : filteredUsers.length === 0 ? (
        <EmptyState icon={UserCog} title="No users found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((p) => (
            <Card key={p.id} className="bg-white p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`h-12 w-12 rounded-full ${getAvatarColor(p.role)} flex items-center justify-center text-white font-semibold shrink-0`}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.full_name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    getInitials(p.full_name)
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {p.full_name}
                    {p.id === currentProfile?.id && (
                      <span className="ml-2 text-xs text-blue-600 font-normal">(You)</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{p.email}</p>
                  
                  {/* Role */}
                  <div className="mt-3">
                    <Select
                      value={p.role}
                      onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)}
                      options={ROLE_OPTIONS}
                      disabled={p.id === currentProfile?.id}
                      className="w-full text-xs"
                    />
                  </div>
                  
                  {/* Status & Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <Badge tone={p.is_active ? 'green' : 'red'}>
                      {p.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                    
                    <button
                      onClick={() => handleToggleActive(p.id, p.is_active)}
                      disabled={p.id === currentProfile?.id}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {p.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      <AddUserModal 
        open={addModalOpen} 
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['profiles'] });
          toast.success('User created successfully');
        }}
      />
    </div>
  );
}
