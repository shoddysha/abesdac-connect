import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { UsersRound, Grid3x3, List, Phone, Mail, Briefcase, Download, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { supabase } from '@/lib/supabase';
import { fetchMembers } from '@/services/members';
import { fetchMinistries } from '@/services/ministries';
import {
  fetchAllMinistryLeaders,
  createMinistryLeader,
  updateMinistryLeader,
  deleteMinistryLeader,
  exportMinistryLeaders,
  getLeadershipRoleLabel,
  type MinistryLeader,
  type LeadershipRole,
} from '@/services/leaders';

const schema = z.object({
  ministry_id: z.string().min(1, 'Required'),
  member_id: z.string().min(1, 'Required'),
  leadership_role: z.string().min(1, 'Required'),
  portfolio: z.string().optional(),
  bio: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const leadershipRoleOptions: { value: LeadershipRole; label: string }[] = [
  { value: 'main_leader', label: 'Main Leader' },
  { value: 'deputy', label: 'Deputy Leader' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'other', label: 'Other' },
];

export function Leaders() {
  const { hasRole, profile } = useAuth();
  const queryClient = useQueryClient();

  const canEdit = hasRole('ministry_leader', 'secretary');
  const canExport = hasRole('administrator', 'pastor', 'secretary');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingLeader, setEditingLeader] = useState<MinistryLeader | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<'ministry' | 'none'>('ministry');

  const leadersQuery = useQuery({
    queryKey: ['ministry-leaders'],
    queryFn: fetchAllMinistryLeaders,
  });

  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
    enabled: canEdit,
  });

  // Get current user's ministry (if they are a ministry leader)
  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);

  const membersQuery = useQuery({
    queryKey: ['members', { ministry_id: userMinistry?.id }],
    queryFn: async () => {
      if (!userMinistry?.id) return [];
      // Fetch only members from the ministry leader's ministry
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'active')
        .or(`ministry_id.eq.${userMinistry.id},ministry_id.is.null`)
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: canEdit && !!userMinistry,
  });

  useRealtimeQuery('ministry_leaders', ['ministry-leaders']);

  const leaders = leadersQuery.data ?? [];

  // Group leaders by ministry
  const leadersByMinistry = leaders.reduce<Record<string, { ministry_name: string; leaders: MinistryLeader[] }>>((acc, leader) => {
    if (!acc[leader.ministry_id]) {
      acc[leader.ministry_id] = {
        ministry_name: leader.ministry_name,
        leaders: [],
      };
    }
    acc[leader.ministry_id].leaders.push(leader);
    return acc;
  }, {});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function canEditLeader(leader: MinistryLeader) {
    if (hasRole('secretary')) return true;
    if (hasRole('ministry_leader')) {
      // Check if current user is the main leader of this ministry
      const ministry = ministriesQuery.data?.find((m) => m.id === leader.ministry_id);
      return ministry?.leader_id === profile?.id;
    }
    return false;
  }

  function openCreate() {
    reset({
      ministry_id: '',
      member_id: '',
      leadership_role: '',
      portfolio: '',
      bio: '',
    });
    setEditingLeader(null);
    setFormOpen(true);
  }

  function openEdit(leader: MinistryLeader) {
    if (!canEditLeader(leader)) return;
    setEditingLeader(leader);
    reset({
      ministry_id: leader.ministry_id,
      member_id: leader.member_id,
      leadership_role: leader.leadership_role,
      portfolio: leader.portfolio || '',
      bio: leader.bio || '',
    });
    setFormOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingLeader) {
        await updateMinistryLeader(editingLeader.id, {
          leadership_role: values.leadership_role as LeadershipRole,
          portfolio: values.portfolio,
          bio: values.bio,
        });
        toast.success('Leader updated');
      } else {
        await createMinistryLeader({
          ministry_id: values.ministry_id,
          member_id: values.member_id,
          leadership_role: values.leadership_role as LeadershipRole,
          portfolio: values.portfolio,
          bio: values.bio,
        });
        toast.success('Leader added');
      }
      queryClient.invalidateQueries({ queryKey: ['ministry-leaders'] });
      setFormOpen(false);
      setEditingLeader(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(leader: MinistryLeader) {
    if (!canEditLeader(leader)) return;
    if (!confirm(`Remove ${leader.member_name} as ${getLeadershipRoleLabel(leader.leadership_role)}?`)) return;
    
    try {
      await deleteMinistryLeader(leader.id);
      queryClient.invalidateQueries({ queryKey: ['ministry-leaders'] });
      toast.success('Leader removed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleExport() {
    try {
      await exportMinistryLeaders(leaders);
      toast.success('Leaders exported');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const getRoleBadgeTone = (role: LeadershipRole) => {
    switch (role) {
      case 'main_leader': return 'primary';
      case 'deputy': return 'secondary';
      case 'secretary': return 'accent';
      case 'treasurer': return 'amber';
      default: return 'slate';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministry Leaders</h1>
          <p className="text-sm text-slate-500">
            Leadership teams for each ministry department
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setGroupBy(groupBy === 'ministry' ? 'none' : 'ministry')}
          >
            <Users className="h-4 w-4" />
            {groupBy === 'ministry' ? 'Ungroup' : 'Group by Ministry'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
            {viewMode === 'grid' ? 'List' : 'Grid'}
          </Button>
          {canEdit && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Leader
            </Button>
          )}
        </div>
      </div>

      {leadersQuery.isLoading ? (
        <Spinner />
      ) : leaders.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No ministry leaders yet"
          description={canEdit ? "Click 'Add Leader' to assign leadership roles" : 'No leaders have been assigned'}
        />
      ) : groupBy === 'ministry' ? (
        // Grouped by Ministry
        <div className="space-y-6">
          {Object.entries(leadersByMinistry).map(([ministryId, group]) => (
            <div key={ministryId}>
              <h2 className="text-lg font-semibold text-ink mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-secondary" />
                {group.ministry_name}
                <Badge tone="slate">{group.leaders.length}</Badge>
              </h2>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.leaders.map((leader) => (
                    <LeaderCard
                      key={leader.id}
                      leader={leader}
                      canEdit={canEditLeader(leader)}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      getRoleBadgeTone={getRoleBadgeTone}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {group.leaders.map((leader) => (
                    <LeaderListItem
                      key={leader.id}
                      leader={leader}
                      canEdit={canEditLeader(leader)}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      getRoleBadgeTone={getRoleBadgeTone}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View (Ungrouped)
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leaders.map((leader) => (
            <LeaderCard
              key={leader.id}
              leader={leader}
              canEdit={canEditLeader(leader)}
              onEdit={openEdit}
              onDelete={handleDelete}
              getRoleBadgeTone={getRoleBadgeTone}
            />
          ))}
        </div>
      ) : (
        // List View (Ungrouped)
        <div className="space-y-2">
          {leaders.map((leader) => (
            <LeaderListItem
              key={leader.id}
              leader={leader}
              canEdit={canEditLeader(leader)}
              onEdit={openEdit}
              onDelete={handleDelete}
              getRoleBadgeTone={getRoleBadgeTone}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingLeader(null);
        }}
        title={editingLeader ? 'Edit Leader' : 'Add Leader'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Ministry"
            disabled={!!editingLeader}
            options={[
              { value: '', label: 'Select ministry' },
              ...(ministriesQuery.data || []).map((m) => ({
                value: m.id,
                label: m.name,
              })),
            ]}
            {...register('ministry_id')}
            error={errors.ministry_id?.message}
          />

          <Select
            label="Member"
            disabled={!!editingLeader}
            options={[
              { value: '', label: 'Select member' },
              ...(membersQuery.data || []).map((m) => ({
                value: m.id,
                label: `${m.first_name} ${m.last_name} (${m.member_code})`,
              })),
            ]}
            {...register('member_id')}
            error={errors.member_id?.message}
          />

          <Select
            label="Leadership Role"
            options={[
              { value: '', label: 'Select role' },
              ...leadershipRoleOptions,
            ]}
            {...register('leadership_role')}
            error={errors.leadership_role?.message}
          />

          <Input
            label="Portfolio/Responsibilities"
            placeholder="e.g., Youth Programs, Sunday School Coordinator"
            {...register('portfolio')}
            error={errors.portfolio?.message}
          />

          <Textarea
            label="Bio/Description"
            placeholder="Brief description of their role and responsibilities"
            rows={3}
            {...register('bio')}
            error={errors.bio?.message}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditingLeader(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingLeader ? 'Save Changes' : 'Add Leader'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Grid Card Component
function LeaderCard({
  leader,
  canEdit,
  onEdit,
  onDelete,
  getRoleBadgeTone,
}: {
  leader: MinistryLeader;
  canEdit: boolean;
  onEdit: (leader: MinistryLeader) => void;
  onDelete: (leader: MinistryLeader) => void;
  getRoleBadgeTone: (role: LeadershipRole) => any;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <Badge tone={getRoleBadgeTone(leader.leadership_role)}>
            {getLeadershipRoleLabel(leader.leadership_role)}
          </Badge>
          <p className="text-xs text-slate-500 mt-1">{leader.ministry_name}</p>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(leader)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(leader)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <h3 className="font-semibold text-ink mb-1">{leader.member_name}</h3>
      <p className="text-xs text-slate-500 mb-2">{leader.member_code}</p>

      {leader.portfolio && (
        <p className="text-sm text-accent font-medium flex items-center gap-1 mb-2">
          <Briefcase className="h-3 w-3" />
          {leader.portfolio}
        </p>
      )}

      {leader.bio && (
        <p className="text-sm text-slate-600 line-clamp-2 mb-3">
          {leader.bio}
        </p>
      )}

      <div className="space-y-1 border-t border-slate-100 pt-2">
        {leader.member_phone && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone className="h-3 w-3 text-slate-400" />
            <a href={`tel:${leader.member_phone}`} className="hover:text-secondary">
              {leader.member_phone}
            </a>
          </div>
        )}
        {leader.member_email && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail className="h-3 w-3 text-slate-400" />
            <a href={`mailto:${leader.member_email}`} className="hover:text-secondary truncate">
              {leader.member_email}
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}

// List Item Component
function LeaderListItem({
  leader,
  canEdit,
  onEdit,
  onDelete,
  getRoleBadgeTone,
}: {
  leader: MinistryLeader;
  canEdit: boolean;
  onEdit: (leader: MinistryLeader) => void;
  onDelete: (leader: MinistryLeader) => void;
  getRoleBadgeTone: (role: LeadershipRole) => any;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div>
            <p className="font-semibold text-ink">{leader.member_name}</p>
            <p className="text-xs text-slate-500">{leader.member_code}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Ministry</p>
            <p className="text-sm text-slate-700">{leader.ministry_name}</p>
          </div>
          <div>
            <Badge tone={getRoleBadgeTone(leader.leadership_role)}>
              {getLeadershipRoleLabel(leader.leadership_role)}
            </Badge>
          </div>
          <div>
            {leader.portfolio && (
              <>
                <p className="text-xs text-slate-500">Portfolio</p>
                <p className="text-sm text-slate-700 truncate">{leader.portfolio}</p>
              </>
            )}
          </div>
          <div>
            {leader.member_phone && (
              <a href={`tel:${leader.member_phone}`} className="text-sm text-slate-700 hover:text-secondary">
                {leader.member_phone}
              </a>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onEdit(leader)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(leader)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
