import { useState, useEffect } from 'react';
import { X, Video, Link as LinkIcon, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface AddVideoTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const VIDEO_CATEGORIES = [
  'Getting Started',
  'Members Management',
  'Events & Calendar',
  'Ministries',
  'Financial Management',
  'Reports & Analytics',
  'Communications',
  'User Management',
  'Settings & Configuration',
];

export function AddVideoTutorialModal({
  isOpen,
  onClose,
  onSuccess,
}: AddVideoTutorialModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    category: 'Getting Started',
    duration_minutes: '',
  });
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  // Extract YouTube video ID from URL
  function extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Update thumbnail when YouTube URL changes
  useEffect(() => {
    if (formData.video_url) {
      const id = extractYouTubeId(formData.video_url);
      if (id) {
        setVideoId(id);
        // YouTube provides different quality thumbnails
        // Try maxresdefault first, fall back to hqdefault
        setThumbnailUrl(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`);
      } else {
        setVideoId(null);
        setThumbnailUrl(null);
      }
    } else {
      setVideoId(null);
      setThumbnailUrl(null);
    }
  }, [formData.video_url]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!videoId) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the video URL (use embed format)
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      
      const { error } = await supabase.from('video_tutorials').insert({
        title: formData.title,
        description: formData.description || null,
        video_url: embedUrl,
        thumbnail_url: thumbnailUrl,
        category: formData.category,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        order_index: 999, // Will be sorted to end initially
        view_count: 0,
        is_published: true,
      });

      if (error) throw error;

      toast.success('Video tutorial added successfully!');
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error adding video:', error);
      toast.error(error.message || 'Failed to add video tutorial');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setFormData({
      title: '',
      description: '',
      video_url: '',
      category: 'Getting Started',
      duration_minutes: '',
    });
    setThumbnailUrl(null);
    setVideoId(null);
    onClose();
  }

  return (
    <Modal open={isOpen} onClose={handleClose} title="Add Video Tutorial" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Video URL */}
        <Input
          label="YouTube Video URL"
          type="text"
          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
          value={formData.video_url}
          onChange={(e) =>
            setFormData({ ...formData, video_url: e.target.value })
          }
          required
          icon={LinkIcon}
        />

        {/* Video Preview */}
        {thumbnailUrl && videoId && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Preview
            </label>
            <div className="relative rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-48 object-cover"
                onError={(e) => {
                  // Fallback to hqdefault if maxresdefault fails
                  e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-red-600 rounded-full p-4 shadow-lg">
                  <Video className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <Input
          label="Video Title"
          type="text"
          placeholder="e.g., How to Add New Members"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />

        {/* Description */}
        <Textarea
          label="Description (Optional)"
          placeholder="Brief description of what this video covers..."
          rows={3}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />

        {/* Category and Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            options={VIDEO_CATEGORIES.map((cat) => ({
              value: cat,
              label: cat,
            }))}
          />

          <Input
            label="Duration (minutes)"
            type="number"
            placeholder="e.g., 5"
            min="1"
            value={formData.duration_minutes}
            onChange={(e) =>
              setFormData({ ...formData, duration_minutes: e.target.value })
            }
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <Upload className="h-4 w-4" />
            Add Video
          </Button>
        </div>
      </form>
    </Modal>
  );
}
