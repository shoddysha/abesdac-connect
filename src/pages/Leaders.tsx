import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UsersRound, Plus, Edit2, Trash2, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import {
  fetchLeaderPosts,
  createLeaderPost,
  updateLeaderPost,
  deleteLeaderPost,
  exportLeaderPosts,
  type LeaderPost,
  type LeaderPostType,
  type LeaderPostStatus,
} from '@/services/leaders';
import { LeaderPostModal } from '@/features/leaders/LeaderPostModal';
import toast from 'react-hot-toast';

export function Leaders() {
  const { hasRole, profile } = useAuth();
  const queryClient = useQueryClient();

  const canEdit = hasRole('ministry_leader', 'secretary');
  const canExport = hasRole('administrator', 'pastor');
  const canDelete = hasRole('secretary', 'ministry_leader');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<LeaderPost | null>(null);
  const [typeFilter, setTypeFilter] = useState<LeaderPostType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<LeaderPostStatus | 'all'>('all');

  const postsQuery = useQuery({
    queryKey: ['leader-posts'],
    queryFn: fetchLeaderPosts,
  });

  useRealtimeQuery('leader_posts', ['leader-posts']);

  const posts = postsQuery.data ?? [];
  const filteredPosts = posts
    .filter((p) => typeFilter === 'all' || p.post_type === typeFilter)
    .filter((p) => statusFilter === 'all' || p.status === statusFilter);

  const announcementCount = posts.filter((p) => p.post_type === 'announcement').length;
  const taskCount = posts.filter((p) => p.post_type === 'task').length;
  const pendingTasks = posts.filter((p) => p.post_type === 'task' && p.status === 'pending').length;

  async function handleSave(data: any) {
    try {
      if (editingPost) {
        await updateLeaderPost(editingPost.id, data);
        toast.success('Post updated');
      } else {
        await createLeaderPost(data);
        toast.success('Post created');
      }
      queryClient.invalidateQueries({ queryKey: ['leader-posts'] });
      setIsModalOpen(false);
      setEditingPost(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return;
    try {
      await deleteLeaderPost(id);
      queryClient.invalidateQueries({ queryKey: ['leader-posts'] });
      toast.success('Post deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleExport() {
    try {
      await exportLeaderPosts(filteredPosts);
      toast.success('Posts exported');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function openEditModal(post: LeaderPost) {
    setEditingPost(post);
    setIsModalOpen(true);
  }

  function openCreateModal() {
    setEditingPost(null);
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministry Leaders</h1>
          <p className="text-sm text-slate-500">
            Coordination and task management for ministry leaders
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
          {canEdit && (
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" /> New Post
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <UsersRound className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{announcementCount}</p>
              <p className="text-xs text-slate-500">Announcements</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{taskCount}</p>
              <p className="text-xs text-slate-500">Total Tasks</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2.5">
              <Clock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{pendingTasks}</p>
              <p className="text-xs text-slate-500">Pending Tasks</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={typeFilter === 'all' ? 'primary' : 'outline'}
            onClick={() => setTypeFilter('all')}
          >
            All Types
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'announcement' ? 'primary' : 'outline'}
            onClick={() => setTypeFilter('announcement')}
          >
            Announcements
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'task' ? 'primary' : 'outline'}
            onClick={() => setTypeFilter('task')}
          >
            Tasks
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'note' ? 'primary' : 'outline'}
            onClick={() => setTypeFilter('note')}
          >
            Notes
          </Button>
        </div>
        {typeFilter === 'task' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={statusFilter === 'all' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('all')}
            >
              All Status
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'pending' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('pending')}
            >
              Pending
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'in_progress' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('in_progress')}
            >
              In Progress
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'completed' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('completed')}
            >
              Completed
            </Button>
          </div>
        )}
      </div>

      {postsQuery.isLoading ? (
        <Spinner />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No posts yet"
          description={canEdit ? "Click 'New Post' to create an announcement or task" : "No posts available"}
        />
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      tone={
                        post.post_type === 'announcement'
                          ? 'blue'
                          : post.post_type === 'task'
                          ? 'amber'
                          : 'purple'
                      }
                    >
                      {post.post_type}
                    </Badge>
                    {post.post_type === 'task' && (
                      <Badge
                        tone={
                          post.status === 'completed'
                            ? 'green'
                            : post.status === 'in_progress'
                            ? 'amber'
                            : 'slate'
                        }
                      >
                        {post.status === 'in_progress' ? 'In Progress' : post.status}
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500">
                      {format(new Date(post.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-1">{post.title}</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{post.content}</p>
                  {post.assigned_to_name && (
                    <p className="text-xs text-slate-500 mt-2">
                      Assigned to: <span className="font-medium">{post.assigned_to_name}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    By {post.created_by_name || 'Unknown'}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(post)}
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {isModalOpen && (
        <LeaderPostModal
          post={editingPost}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPost(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
