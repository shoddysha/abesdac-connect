import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Heart,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const followUpSchema = z.object({
  member_id: z.string().min(1, 'Member is required'),
  follow_up_type: z.enum(['pastoral_care', 'new_member', 'inactive', 'sick_visit', 'prayer_request', 'other']),
  description: z.string().min(1, 'Description is required'),
  follow_up_date: z.string().min(1, 'Follow-up date is required'),
  priority: z.enum(['low', 'medium', 'high']),
});
type FollowUpFormValues = z.infer<typeof followUpSchema>;

export function MemberFollowUp() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ministries').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const userMinistry = ministriesQuery.data?.find((m: any) => m.leader_id === profile?.id);

  // Fetch follow-ups for this ministry with real-time updates
  const followUpsQuery = useQuery({
    queryKey: ['member-followups', userMinistry?.id],
    queryFn: async () => {
      if (!userMinistry) return [];
      const { data, error } = await supabase
        .from('member_followups')
        .select('*, members(first_name, last_name, member_code, phone, email)')
        .eq('ministry_id', userMinistry.id)
        .order('follow_up_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userMinistry,
  });

  // Fetch members in this ministry
  const membersQuery = useQuery({
    queryKey: ['ministry-members', userMinistry?.id],
    queryFn: async () => {
      if (!userMinistry) return [];
      const { data, error } = await supabase
        .from('ministry_members')
        .select('members(*)')
        .eq('ministry_id', userMinistry.id);
      if (error) throw error;
      return (data || [])
        .map((row: any) => row.members)
        .filter((m: any) => m && m.status === 'active');
    },
    enabled: !!userMinistry,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FollowUpFormValues>({ 
    resolver: zodResolver(followUpSchema),
    defaultValues: {
      priority: 'medium',
      follow_up_date: new Date().toISOString().split('T')[0],
    }
  });

  // Real-time subscription
  useRealtimeQuery('member_followups', ['member-followups', userMinistry?.id]);

  const followUps = followUpsQuery.data ?? [];
  const filteredFollowUps = followUps
    .filter((fu: any) => {
      if (filter === 'pending') return !fu.completed_at;
      if (filter === 'completed') return fu.completed_at;
      return true;
    })
    .filter((fu: any) => {
      if (typeFilter !== 'all') return fu.follow_up_type === typeFilter;
      return true;
    })
    .filter((fu: any) => {
      const memberName = `${fu.members?.first_name} ${fu.members?.last_name}`.toLowerCase();
      return memberName.includes(search.toLowerCase());
    });

  async function onSubmit(values: FollowUpFormValues) {
    try {
      const { error } = await supabase.from('member_followups').insert([
        {
          ...values,
          ministry_id: userMinistry!.id,
          created_by: profile?.id,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
      toast.success('Follow-up added');
      setFormOpen(false);
      reset({
        priority: 'medium',
        follow_up_date: new Date().toISOString().split('T')[0],
      });
      queryClient.invalidateQueries({ queryKey: ['member-followups'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggleComplete(id: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from('member_followups')
        .update({ completed_at: currentState ? null : new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentState ? 'Marked as pending' : 'Marked as complete');
      queryClient.invalidateQueries({ queryKey: ['member-followups'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this follow-up?')) return;
    try {
      const { error } = await supabase.from('member_followups').delete().eq('id', id);
      if (error) throw error;
      toast.success('Follow-up deleted');
      queryClient.invalidateQueries({ queryKey: ['member-followups'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Member Follow-up</h1>
        <EmptyState
          icon={Heart}
          title="No ministry assigned"
          description="You need to be assigned as a ministry leader to access this page"
        />
      </div>
    );
  }

  const pendingCount = followUps.filter((fu: any) => !fu.completed_at).length;
  const completedCount = followUps.filter((fu: any) => fu.completed_at).length;
  const highPriorityCount = followUps.filter((fu: any) => !fu.completed_at && fu.priority === 'high').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Member Follow-up Tracker</h1>
          <p className="text-sm text-slate-500">Track pastoral care and member engagement</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Add Follow-up
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Follow-ups</p>
              <p className="text-2xl font-bold text-ink">{followUps.length}</p>
            </div>
            <Heart className="h-8 w-8 text-red-200" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-200" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">High Priority</p>
              <p className="text-2xl font-bold text-red-600">{highPriorityCount}</p>
            </div>
            <Filter className="h-8 w-8 text-red-200" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-200" />
          </div>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium bg-white"
          >
            <option value="all">All Types</option>
            <option value="pastoral_care">Pastoral Care</option>
            <option value="new_member">New Member</option>
            <option value="inactive">Inactive Member</option>
            <option value="sick_visit">Sick Visit</option>
            <option value="prayer_request">Prayer Request</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Follow-ups List */}
      {followUpsQuery.isLoading ? (
        <Spinner />
      ) : filteredFollowUps.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No follow-ups found"
          description={
            filter === 'pending'
              ? 'Add follow-ups for members who need pastoral care'
              : 'All follow-ups are completed'
          }
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Add Follow-up
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredFollowUps.map((followUp: any) => (
            <Card key={followUp.id} className="hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink truncate">
                      {followUp.members?.first_name} {followUp.members?.last_name}
                    </h3>
                    <Badge
                      tone={
                        followUp.priority === 'high'
                          ? 'red'
                          : followUp.priority === 'medium'
                          ? 'slate'
                          : 'blue'
                      }
                    >
                      {followUp.priority}
                    </Badge>
                    <Badge tone={followUp.completed_at ? 'green' : 'amber'}>
                      {followUp.follow_up_type.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm text-slate-600 break-words">{followUp.description}</p>

                  <div className="mt-3 flex flex-wrap gap-2 sm:gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {format(new Date(followUp.follow_up_date), 'MMM d, yyyy')}
                    </span>
                    {followUp.members?.phone && (
                      <a
                        href={`tel:${followUp.members.phone}`}
                        className="flex items-center gap-1 hover:text-secondary"
                      >
                        <Phone className="h-3 w-3 shrink-0" />
                        {followUp.members.phone}
                      </a>
                    )}
                    {followUp.members?.email && (
                      <a
                        href={`mailto:${followUp.members.email}`}
                        className="flex items-center gap-1 hover:text-secondary min-w-0"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{followUp.members.email}</span>
                      </a>
                    )}
                  </div>

                  {followUp.completed_at && (
                    <p className="mt-2 text-xs text-emerald-600 font-medium">
                      ✓ Completed {format(new Date(followUp.completed_at), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleComplete(followUp.id, !!followUp.completed_at)}
                    className={`rounded-md p-2 transition-colors ${
                      followUp.completed_at
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                    }`}
                    title={followUp.completed_at ? 'Mark as pending' : 'Mark as complete'}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(followUp.id)}
                    className="rounded-md p-2 bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Follow-up">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Member *</label>
            <select
              {...register('member_id')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50 bg-white"
            >
              <option value="">Select member...</option>
              {(membersQuery.data || []).map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.member_code})
                </option>
              ))}
            </select>
            {errors.member_id && <p className="text-xs text-red-600 mt-1">{errors.member_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Follow-up Type *</label>
            <select
              {...register('follow_up_type')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50 bg-white"
            >
              <option value="">Select type...</option>
              <option value="pastoral_care">Pastoral Care</option>
              <option value="new_member">New Member</option>
              <option value="inactive">Inactive Member</option>
              <option value="sick_visit">Sick Visit</option>
              <option value="prayer_request">Prayer Request</option>
              <option value="other">Other</option>
            </select>
            {errors.follow_up_type && (
              <p className="text-xs text-red-600 mt-1">{errors.follow_up_type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Description *</label>
            <textarea
              {...register('description')}
              placeholder="Details about the follow-up..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50 resize-none"
              rows={3}
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Follow-up Date *</label>
              <input
                type="date"
                {...register('follow_up_date')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50"
              />
              {errors.follow_up_date && (
                <p className="text-xs text-red-600 mt-1">{errors.follow_up_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">Priority</label>
              <select
                {...register('priority')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50 bg-white"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200 mt-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
              Add Follow-up
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
