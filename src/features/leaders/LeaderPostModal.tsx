import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { LeaderPost, LeaderPostType, LeaderPostStatus } from '@/services/leaders';
import { supabase } from '@/lib/supabase';

interface LeaderPostModalProps {
  post: LeaderPost | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export function LeaderPostModal({ post, onClose, onSave }: LeaderPostModalProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [postType, setPostType] = useState<LeaderPostType>(post?.post_type || 'announcement');
  const [assignedTo, setAssignedTo] = useState<string>(post?.assigned_to || '');
  const [status, setStatus] = useState<LeaderPostStatus>(post?.status || 'pending');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch ministry leaders for assignment
  const { data: leaders } = useQuery({
    queryKey: ['ministry-leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'ministry_leader')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSave({
        title,
        content,
        post_type: postType,
        assigned_to: assignedTo || null,
        status: postType === 'task' ? status : 'pending',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={post ? 'Edit Post' : 'New Post'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Type</label>
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value as LeaderPostType)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
            required
          >
            <option value="announcement">Announcement</option>
            <option value="task">Task</option>
            <option value="note">Note</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter content"
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
            required
          />
        </div>

        {postType === 'task' && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Assign To</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
              >
                <option value="">-- Unassigned --</option>
                {leaders?.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeaderPostStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {post ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
