import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserCog, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchProfiles, updateProfileRole, setProfileActive } from '@/services/users';
import { useAuth } from '@/contexts/AuthContext';
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
  const query = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">User management</h1>
        <p className="text-sm text-slate-500">Assign roles and control who can sign in.</p>
      </div>

      <Card className="flex items-start gap-3 bg-secondary-50/40">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        <p className="text-sm text-slate-600">
          To add a brand-new team member, an administrator creates their account from{' '}
          <span className="font-medium">Supabase Studio → Authentication → Users → Add user</span>. A matching profile
          is created automatically — come back here afterwards to set their role. See the README's "Adding new users"
          section for the exact steps.
        </p>
      </Card>

      {query.isLoading ? (
        <Spinner />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState icon={UserCog} title="No users found" />
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data!.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-ink">
                    {p.full_name} {p.id === currentProfile?.id && <span className="text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={p.role}
                      onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)}
                      options={ROLE_OPTIONS}
                      disabled={p.id === currentProfile?.id}
                      className="w-44"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={p.is_active ? 'green' : 'red'}>{p.is_active ? 'Active' : 'Disabled'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(p.id, p.is_active)}
                      disabled={p.id === currentProfile?.id}
                      className="rounded-md px-2 py-1 text-xs font-medium text-secondary hover:bg-secondary-50 disabled:opacity-40"
                    >
                      {p.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
