import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Video,
  FileText,
  Plus,
  Edit,
  Trash2,
  Download,
  Eye,
  Calendar,
  User,
  AlertCircle,
  Upload,
  Youtube,
  BookOpen,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { YouTubePreview } from '@/components/YouTubePreview';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMinistries } from '@/services/ministries';
import {
  fetchSermons,
  fetchDocuments,
  createSermon,
  createDocument,
  updateSermon,
  deleteSermon,
  deleteDocument,
  incrementDocumentDownloads,
  extractYouTubeId,
  type Sermon,
  type ChurchDocument,
  type DocumentCategory,
} from '@/services/resources';
import { fetchVideoTutorials, incrementVideoView, type VideoTutorial } from '@/services/help';
import { AddVideoTutorialModal } from '@/features/help/AddVideoTutorialModal';

const sermonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  youtube_url: z.string().url('Must be a valid URL').refine((url) => {
    return extractYouTubeId(url) !== null;
  }, 'Must be a valid YouTube URL'),
  preacher_name: z.string().min(1, 'Preacher name is required'),
  date_preached: z.string().min(1, 'Date is required'),
  scripture_reference: z.string().optional(),
  description: z.string().optional(),
  ministry_id: z.string().optional(),
  is_featured: z.boolean().optional(),
});

const documentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['bulletin', 'announcement', 'report', 'newsletter', 'policy', 'other']),
  description: z.string().optional(),
  is_public: z.boolean().optional(),
});

type SermonFormValues = z.infer<typeof sermonSchema>;
type DocumentFormValues = z.infer<typeof documentSchema>;
type Tab = 'sermons' | 'documents' | 'tutorials';

export function Resources() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('sermons');
  const [isSermonModalOpen, setIsSermonModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSermon, setPreviewSermon] = useState<Sermon | null>(null);
  const [previewTutorial, setPreviewTutorial] = useState<VideoTutorial | null>(null);

  const canUploadSermons = hasRole('administrator', 'secretary') || hasRole('ministry_leader'); // Will check for media ministry specifically
  const canUploadDocuments = hasRole('administrator', 'secretary');
  const canUploadTutorials = hasRole('administrator', 'secretary');

  // Queries
  const sermonsQuery = useQuery({
    queryKey: ['sermons'],
    queryFn: () => fetchSermons(),
  });

  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: () => fetchDocuments(),
  });

  const tutorialsQuery = useQuery({
    queryKey: ['video-tutorials'],
    queryFn: () => fetchVideoTutorials(),
  });

  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  // Sermon Form
  const sermonForm = useForm<SermonFormValues>({
    resolver: zodResolver(sermonSchema),
    defaultValues: {
      title: '',
      youtube_url: '',
      preacher_name: '',
      date_preached: format(new Date(), 'yyyy-MM-dd'),
      scripture_reference: '',
      description: '',
      is_featured: false,
    },
  });

  // Document Form
  const documentForm = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: '',
      category: 'bulletin',
      description: '',
      is_public: true,
    },
  });

  // Mutations
  const createSermonMutation = useMutation({
    mutationFn: createSermon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sermons'] });
      toast.success('Sermon uploaded successfully!');
      setIsSermonModalOpen(false);
      sermonForm.reset();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully!');
      setIsDocumentModalOpen(false);
      documentForm.reset();
      setSelectedFile(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteSermonMutation = useMutation({
    mutationFn: deleteSermon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sermons'] });
      toast.success('Sermon deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const sermons = sermonsQuery.data || [];
  const documents = documentsQuery.data || [];
  const tutorials = tutorialsQuery.data || [];
  const ministries = ministriesQuery.data || [];

  function handleSermonSubmit(values: SermonFormValues) {
    createSermonMutation.mutate(values);
  }

  function handleDocumentSubmit(values: DocumentFormValues) {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    createDocumentMutation.mutate({
      ...values,
      file: selectedFile,
    });
  }

  function handleDeleteSermon(id: string, title: string) {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteSermonMutation.mutate(id);
    }
  }

  function handleDeleteDocument(id: string, title: string) {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteDocumentMutation.mutate(id);
    }
  }

  async function handleDownloadDocument(doc: ChurchDocument) {
    await incrementDocumentDownloads(doc.id);
    window.open(doc.file_url, '_blank');
  }

  function handleTutorialAdded() {
    queryClient.invalidateQueries({ queryKey: ['video-tutorials'] });
  }

  function handleTutorialClick(tutorial: VideoTutorial) {
    incrementVideoView(tutorial.id);
    setPreviewTutorial(tutorial);
  }

  const categoryLabels: Record<DocumentCategory, string> = {
    bulletin: 'Bulletin',
    announcement: 'Announcement',
    report: 'Report',
    newsletter: 'Newsletter',
    policy: 'Policy',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Church Resources</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage sermons and church documents
        </p>
      </div>

      {/* Coming Soon Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <CheckCircle className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900">Website Integration Coming Soon!</h3>
            <p className="text-sm text-blue-700 mt-1">
              Resources uploaded here will automatically appear on the main church website's sermon page. 
              Members will be able to watch sermons and download documents directly from the website.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
              <Clock className="h-4 w-4" />
              <span>Feature will be available once the main website is updated</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('sermons')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sermons'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-ink hover:border-slate-300'
            }`}
          >
            <Video className="h-4 w-4" />
            Sermons
            <Badge tone="blue">{sermons.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab('tutorials')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tutorials'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-ink hover:border-slate-300'
            }`}
          >
            <Youtube className="h-4 w-4" />
            Video Tutorials
            <Badge tone="purple">{tutorials.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-ink hover:border-slate-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents
            <Badge tone="blue">{documents.length}</Badge>
          </button>
        </nav>
      </div>

      {/* Sermons Tab */}
      {activeTab === 'sermons' && (
        <div className="space-y-6">
          {/* Upload Button */}
          {canUploadSermons && (
            <div className="flex justify-end">
              <Button onClick={() => setIsSermonModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Upload Sermon
              </Button>
            </div>
          )}

          {/* Sermons List */}
          {sermonsQuery.isLoading ? (
            <Spinner />
          ) : sermons.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No sermons yet"
              description={canUploadSermons ? "Upload your first sermon to get started" : "No sermons have been uploaded yet"}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sermons.map((sermon) => (
                <Card key={sermon.id} className="overflow-hidden">
                  <div className="cursor-pointer" onClick={() => setPreviewSermon(sermon)}>
                    <YouTubePreview
                      url={sermon.youtube_url}
                      title={sermon.title}
                      className="aspect-video"
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-ink line-clamp-2">{sermon.title}</h3>
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                        <User className="h-4 w-4" />
                        <span>{sermon.preacher_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(sermon.date_preached), 'MMM d, yyyy')}</span>
                      </div>
                      {sermon.scripture_reference && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                          <BookOpen className="h-4 w-4" />
                          <span>{sermon.scripture_reference}</span>
                        </div>
                      )}
                    </div>

                    {sermon.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">{sermon.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Eye className="h-3 w-3" />
                        <span>{sermon.view_count} views</span>
                      </div>
                      {hasRole('administrator') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteSermon(sermon.id, sermon.title)}
                          isLoading={deleteSermonMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video Tutorials Tab */}
      {activeTab === 'tutorials' && (
        <div className="space-y-6">
          {/* Upload Button */}
          {canUploadTutorials && (
            <div className="flex justify-end">
              <Button onClick={() => setIsTutorialModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Video Tutorial
              </Button>
            </div>
          )}

          {/* Tutorials List */}
          {tutorialsQuery.isLoading ? (
            <Spinner />
          ) : tutorials.length === 0 ? (
            <EmptyState
              icon={Youtube}
              title="No video tutorials yet"
              description={canUploadTutorials ? "Add your first tutorial video to help users learn the system" : "No video tutorials have been added yet"}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tutorials.map((tutorial) => (
                <Card key={tutorial.id} className="overflow-hidden">
                  <div className="cursor-pointer" onClick={() => handleTutorialClick(tutorial)}>
                    {tutorial.thumbnail_url ? (
                      <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full h-48 object-cover" />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
                        <Youtube className="h-12 w-12 text-purple-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-ink line-clamp-2">{tutorial.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge tone="purple">{tutorial.category}</Badge>
                        {tutorial.duration_minutes && (
                          <span className="text-xs text-slate-500">{tutorial.duration_minutes} min</span>
                        )}
                      </div>
                    </div>

                    {tutorial.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">{tutorial.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Eye className="h-3 w-3" />
                        <span>{tutorial.view_count} views</span>
                      </div>
                      {hasRole('administrator') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete "${tutorial.title}"?`)) {
                              // TODO: Add delete tutorial mutation
                              toast.success('Delete functionality coming soon');
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Upload Button */}
          {canUploadDocuments && (
            <div className="flex justify-end">
              <Button onClick={() => setIsDocumentModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Upload Document
              </Button>
            </div>
          )}

          {/* Documents List */}
          {documentsQuery.isLoading ? (
            <Spinner />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description={canUploadDocuments ? "Upload your first document to get started" : "No documents have been uploaded yet"}
            />
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-red-50 rounded-lg shrink-0">
                        <FileText className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink">{doc.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <Badge tone="blue">{categoryLabels[doc.category]}</Badge>
                          <span className="text-xs text-slate-500">
                            {format(new Date(doc.created_at), 'MMM d, yyyy')}
                          </span>
                          {doc.file_size && (
                            <span className="text-xs text-slate-500">
                              {(doc.file_size / 1024).toFixed(0)} KB
                            </span>
                          )}
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {doc.download_count} downloads
                          </span>
                        </div>
                        {doc.description && (
                          <p className="text-sm text-slate-600 mt-2">{doc.description}</p>
                        )}
                        {doc.profiles && (
                          <p className="text-xs text-slate-500 mt-2">
                            Uploaded by {doc.profiles.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadDocument(doc)}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      {hasRole('administrator') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteDocument(doc.id, doc.title)}
                          isLoading={deleteDocumentMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Sermon Modal */}
      <Modal
        open={isSermonModalOpen}
        onClose={() => setIsSermonModalOpen(false)}
        title="Upload Sermon"
        size="lg"
      >
        <form onSubmit={sermonForm.handleSubmit(handleSermonSubmit)} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Youtube className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Upload to YouTube first</p>
              <p className="mt-1">
                Upload your sermon video to YouTube, then paste the YouTube URL here. 
                The video will be embedded and displayed with a preview.
              </p>
            </div>
          </div>

          <Input
            label="Sermon Title"
            placeholder="e.g., The Power of Faith"
            {...sermonForm.register('title')}
            error={sermonForm.formState.errors.title?.message}
          />

          <Input
            label="YouTube URL"
            placeholder="https://www.youtube.com/watch?v=..."
            {...sermonForm.register('youtube_url')}
            error={sermonForm.formState.errors.youtube_url?.message}
          />

          <Input
            label="Preacher Name"
            placeholder="e.g., Pastor John Doe"
            {...sermonForm.register('preacher_name')}
            error={sermonForm.formState.errors.preacher_name?.message}
          />

          <Input
            label="Date Preached"
            type="date"
            {...sermonForm.register('date_preached')}
            error={sermonForm.formState.errors.date_preached?.message}
          />

          <Input
            label="Scripture Reference (Optional)"
            placeholder="e.g., John 3:16-21"
            {...sermonForm.register('scripture_reference')}
          />

          <Textarea
            label="Description (Optional)"
            rows={3}
            placeholder="Brief description of the sermon..."
            {...sermonForm.register('description')}
          />

          {canUploadDocuments && (
            <Select
              label="Ministry (Optional)"
              {...sermonForm.register('ministry_id')}
              options={[
                { value: '', label: 'None' },
                ...ministries.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_featured"
              {...sermonForm.register('is_featured')}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <label htmlFor="is_featured" className="text-sm text-ink cursor-pointer">
              Feature this sermon on the homepage
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSermonModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createSermonMutation.isPending}>
              <Upload className="h-4 w-4" />
              Upload Sermon
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        open={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
        title="Upload Document"
        size="lg"
      >
        <form onSubmit={documentForm.handleSubmit(handleDocumentSubmit)} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">PDF files only (Max 10MB)</p>
              <p className="mt-1">
                Only PDF documents are supported. Files are stored securely in Supabase Storage.
              </p>
            </div>
          </div>

          <Input
            label="Document Title"
            placeholder="e.g., Weekly Bulletin - Jan 15"
            {...documentForm.register('title')}
            error={documentForm.formState.errors.title?.message}
          />

          <Select
            label="Category"
            {...documentForm.register('category')}
            options={[
              { value: 'bulletin', label: 'Bulletin' },
              { value: 'announcement', label: 'Announcement' },
              { value: 'report', label: 'Report' },
              { value: 'newsletter', label: 'Newsletter' },
              { value: 'policy', label: 'Policy' },
              { value: 'other', label: 'Other' },
            ]}
            error={documentForm.formState.errors.category?.message}
          />

          <Textarea
            label="Description (Optional)"
            rows={3}
            placeholder="Brief description of the document..."
            {...documentForm.register('description')}
          />

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Upload File
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-primary file:text-white
                hover:file:bg-primary/90
                file:cursor-pointer cursor-pointer"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-slate-600">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              {...documentForm.register('is_public')}
              defaultChecked
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <label htmlFor="is_public" className="text-sm text-ink cursor-pointer">
              Make this document publicly accessible
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDocumentModalOpen(false);
                setSelectedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createDocumentMutation.isPending}
              disabled={!selectedFile}
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sermon Preview Modal */}
      {previewSermon && (
        <Modal
          open={!!previewSermon}
          onClose={() => setPreviewSermon(null)}
          title={previewSermon.title}
          size="xl"
        >
          <div className="space-y-4">
            <YouTubePreview
              url={previewSermon.youtube_url}
              title={previewSermon.title}
              autoplay
              className="aspect-video"
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="h-4 w-4" />
                <span className="font-medium">{previewSermon.preacher_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(previewSermon.date_preached), 'MMMM d, yyyy')}</span>
              </div>
              {previewSermon.scripture_reference && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <BookOpen className="h-4 w-4" />
                  <span>{previewSermon.scripture_reference}</span>
                </div>
              )}
            </div>
            {previewSermon.description && (
              <div>
                <h4 className="text-sm font-medium text-ink mb-2">Description</h4>
                <p className="text-sm text-slate-600">{previewSermon.description}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Tutorial Preview Modal */}
      {previewTutorial && (
        <Modal
          open={!!previewTutorial}
          onClose={() => setPreviewTutorial(null)}
          title={previewTutorial.title}
          size="xl"
        >
          <div className="space-y-4">
            <YouTubePreview
              url={previewTutorial.video_url}
              title={previewTutorial.title}
              autoplay
              className="aspect-video"
            />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge tone="purple">{previewTutorial.category}</Badge>
                {previewTutorial.duration_minutes && (
                  <span className="text-sm text-slate-600">{previewTutorial.duration_minutes} minutes</span>
                )}
                <span className="text-sm text-slate-500">{previewTutorial.view_count} views</span>
              </div>
            </div>
            {previewTutorial.description && (
              <div>
                <h4 className="text-sm font-medium text-ink mb-2">Description</h4>
                <p className="text-sm text-slate-600">{previewTutorial.description}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add Video Tutorial Modal */}
      <AddVideoTutorialModal
        isOpen={isTutorialModalOpen}
        onClose={() => setIsTutorialModalOpen(false)}
        onSuccess={handleTutorialAdded}
      />
    </div>
  );
}
