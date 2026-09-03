import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Book, Mail, Phone, FileText, Video, ChevronDown, ChevronRight, Calendar, CheckCircle, Eye } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import {
  fetchReleaseNotes,
  fetchLatestRelease,
  fetchDocumentation,
  fetchDocumentationCategories,
  fetchVideoTutorials,
  fetchFAQs,
  fetchFAQCategories,
  incrementFAQView,
  incrementVideoView,
  type Documentation,
  type VideoTutorial,
} from '@/services/help';
import { DocumentationDetailModal } from '@/features/help/DocumentationDetailModal';
import { Modal } from '@/components/ui/Modal';
import { YouTubePreview } from '@/components/YouTubePreview';
import { format } from 'date-fns';

export function HelpSupport() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'documentation' | 'videos' | 'faq' | 'releases'>('documentation');
  const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [previewTutorial, setPreviewTutorial] = useState<VideoTutorial | null>(null);

  // Queries
  const releaseNotesQuery = useQuery({
    queryKey: ['release-notes'],
    queryFn: fetchReleaseNotes,
  });

  const latestReleaseQuery = useQuery({
    queryKey: ['latest-release'],
    queryFn: fetchLatestRelease,
  });

  const documentationQuery = useQuery({
    queryKey: ['help-documentation', selectedCategory],
    queryFn: () => selectedCategory === 'all' ? fetchDocumentation() : fetchDocumentation(selectedCategory),
  });

  const docCategoriesQuery = useQuery({
    queryKey: ['doc-categories'],
    queryFn: fetchDocumentationCategories,
  });

  const videosQuery = useQuery({
    queryKey: ['video-tutorials'],
    queryFn: () => fetchVideoTutorials(),
  });

  const faqsQuery = useQuery({
    queryKey: ['faqs', selectedCategory],
    queryFn: () => selectedCategory === 'all' ? fetchFAQs() : fetchFAQs(selectedCategory),
  });

  const faqCategoriesQuery = useQuery({
    queryKey: ['faq-categories'],
    queryFn: fetchFAQCategories,
  });

  // Real-time updates
  useRealtimeQuery('release_notes', ['release-notes', 'latest-release']);
  useRealtimeQuery('help_documentation', ['help-documentation', selectedCategory]);
  useRealtimeQuery('video_tutorials', ['video-tutorials']);
  useRealtimeQuery('faqs', ['faqs', selectedCategory]);

  const documentation = documentationQuery.data || [];
  const docCategories = docCategoriesQuery.data || [];
  const videos = videosQuery.data || [];
  const faqs = faqsQuery.data || [];
  const faqCategories = faqCategoriesQuery.data || [];
  const releaseNotes = releaseNotesQuery.data || [];
  const latestRelease = latestReleaseQuery.data;

  // Group documentation by category
  const groupedDocs = useMemo(() => {
    const groups: Record<string, typeof documentation> = {};
    documentation.forEach(doc => {
      if (!groups[doc.category]) {
        groups[doc.category] = [];
      }
      groups[doc.category].push(doc);
    });
    return groups;
  }, [documentation]);

  // Group FAQs by category
  const groupedFaqs = useMemo(() => {
    const groups: Record<string, typeof faqs> = {};
    faqs.forEach(faq => {
      if (!groups[faq.category]) {
        groups[faq.category] = [];
      }
      groups[faq.category].push(faq);
    });
    return groups;
  }, [faqs]);

  function toggleFaq(id: string) {
    setExpandedFaq(expandedFaq === id ? null : id);
    if (expandedFaq !== id) {
      incrementFAQView(id);
    }
  }

  function handleDocClick(doc: Documentation) {
    setSelectedDoc(doc);
    setIsDocModalOpen(true);
  }

  function handleVideoClick(videoId: string) {
    incrementVideoView(videoId);
  }

  function handleVideoAdded() {
    queryClient.invalidateQueries({ queryKey: ['video-tutorials'] });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Help & Support</h1>
        <p className="text-sm text-slate-500 mt-1">Get help and find answers to common questions</p>
      </div>

      {/* Latest Release Banner */}
      {latestRelease && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 flex-shrink-0">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900">Latest Release: v{latestRelease.version}</h3>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">NEW</span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{latestRelease.title}</p>
              <p className="text-xs text-slate-500">{latestRelease.description}</p>
            </div>
            <button
              onClick={() => setActiveTab('releases')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              View Details →
            </button>
          </div>
        </Card>
      )}

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="text-center">
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-3">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Email Support</h3>
            <p className="text-sm text-slate-500 mb-3">support@abesdac-connect.org</p>
            <a 
              href="mailto:support@abesdac-connect.org" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Send Email
            </a>
          </div>
        </Card>

        <Card className="text-center">
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
              <Phone className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Phone Support</h3>
            <p className="text-sm text-slate-500 mb-3">+233 XX XXX XXXX</p>
            <a 
              href="tel:+233XXXXXXXXX" 
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              Call Now
            </a>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {[
          { value: 'documentation', label: 'User Guide', icon: Book },
          { value: 'videos', label: 'Video Tutorials', icon: Video },
          { value: 'faq', label: 'FAQs', icon: HelpCircle },
          { value: 'releases', label: 'Release Notes', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Documentation Tab */}
        {activeTab === 'documentation' && (
          <div className="space-y-4">
            {/* Category Filter */}
            {docCategories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {docCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            {documentationQuery.isLoading ? (
              <Spinner />
            ) : documentation.length === 0 ? (
              <EmptyState icon={Book} title="No documentation available" description="Documentation will be added soon." />
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedDocs).map(([category, docs]) => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">{category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {docs.map((doc) => (
                        <Card 
                          key={doc.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleDocClick(doc)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
                              <Book className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-slate-900 mb-1">{doc.title}</h4>
                              <p className="text-sm text-slate-500 line-clamp-2">{doc.content.substring(0, 100)}...</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Video Tutorials Tab */}
        {activeTab === 'videos' && (
          <div>
            {videosQuery.isLoading ? (
              <Spinner />
            ) : videos.length === 0 ? (
              <EmptyState 
                icon={Video} 
                title="No video tutorials yet" 
                description="Video tutorials will appear here once they are uploaded in the Resources page."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <Card 
                    key={video.id} 
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      incrementVideoView(video.id);
                      setPreviewTutorial(video);
                    }}
                  >
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-48 object-cover" />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
                        <Video className="h-12 w-12 text-purple-600" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge tone="purple">{video.category}</Badge>
                        {video.duration_minutes && (
                          <span className="text-xs text-slate-500">{video.duration_minutes} min</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-slate-900 line-clamp-2 mb-2">{video.title}</h4>
                      {video.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{video.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Eye className="h-3 w-3" />
                        <span>{video.view_count} views</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="space-y-4">
            {/* Category Filter */}
            {faqCategories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {faqCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            {faqsQuery.isLoading ? (
              <Spinner />
            ) : faqs.length === 0 ? (
              <EmptyState icon={HelpCircle} title="No FAQs available" description="FAQs will be added soon." />
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedFaqs).map(([category, categoryFaqs]) => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">{category}</h3>
                    <div className="space-y-2">
                      {categoryFaqs.map((faq) => {
                        const isExpanded = expandedFaq === faq.id;
                        
                        return (
                          <Card key={faq.id} className="cursor-pointer hover:shadow-sm transition-shadow">
                            <button
                              onClick={() => toggleFaq(faq.id)}
                              className="w-full flex items-start justify-between gap-3 text-left"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-slate-900 mb-1">{faq.question}</h4>
                                  {isExpanded && (
                                    <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
                                      {faq.answer}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                              )}
                            </button>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Release Notes Tab */}
        {activeTab === 'releases' && (
          <div>
            {releaseNotesQuery.isLoading ? (
              <Spinner />
            ) : releaseNotes.length === 0 ? (
              <EmptyState icon={FileText} title="No release notes available" description="Release notes will be added soon." />
            ) : (
              <div className="space-y-6">
                {releaseNotes.map((release) => (
                  <Card key={release.id}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-slate-900">v{release.version}</h3>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                            {format(new Date(release.release_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <h4 className="text-lg font-semibold text-slate-700">{release.title}</h4>
                        {release.description && (
                          <p className="text-sm text-slate-500 mt-1">{release.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Features */}
                    {release.features && release.features.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          New Features
                        </h5>
                        <ul className="space-y-2">
                          {release.features.map((feature, idx) => (
                            <li key={idx} className="text-sm text-slate-600 pl-6 relative">
                              <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-green-500"></span>
                              <strong>{feature.title}:</strong> {feature.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Bug Fixes */}
                    {release.bug_fixes && release.bug_fixes.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Bug Fixes
                        </h5>
                        <ul className="space-y-2">
                          {release.bug_fixes.map((fix, idx) => (
                            <li key={idx} className="text-sm text-slate-600 pl-6 relative">
                              <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500"></span>
                              <strong>{fix.title}:</strong> {fix.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improvements */}
                    {release.improvements && release.improvements.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Improvements
                        </h5>
                        <ul className="space-y-2">
                          {release.improvements.map((improvement, idx) => (
                            <li key={idx} className="text-sm text-slate-600 pl-6 relative">
                              <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                              <strong>{improvement.title}:</strong> {improvement.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Information */}
      <Card className="bg-slate-50">
        <h3 className="font-semibold text-slate-900 mb-3">System Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Version:</span>
            <span className="ml-2 font-medium text-slate-900">4.1.0</span>
          </div>
          <div>
            <span className="text-slate-500">Your Role:</span>
            <span className="ml-2 font-medium text-slate-900 capitalize">
              {profile?.role.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-500">User ID:</span>
            <span className="ml-2 font-medium text-slate-900">{profile?.id.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-slate-500">Last Updated:</span>
            <span className="ml-2 font-medium text-slate-900">August 31, 2026</span>
          </div>
        </div>
      </Card>

      {/* Modals */}
      <DocumentationDetailModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        documentation={selectedDoc}
        allDocs={documentation}
      />

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
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {previewTutorial.view_count} views
                </span>
              </div>
            </div>
            {previewTutorial.description && (
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-2">About this tutorial</h4>
                <p className="text-sm text-slate-600">{previewTutorial.description}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
