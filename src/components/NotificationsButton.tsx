import { useState } from 'react';
import { Bell, Megaphone, FileText, Heart, DollarSign, Clock, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ReportDeadlineNotifications } from '@/components/ReportDeadlineNotifications';
import { fetchAnnouncementsWithViewStatus, markAnnouncementAsViewed } from '@/services/announcements';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export function NotificationsButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: counts } = useNotificationCounts();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch unviewed announcements
  const { data: announcements } = useQuery({
    queryKey: ['announcements-with-views'],
    queryFn: fetchAnnouncementsWithViewStatus,
    enabled: modalOpen && (counts?.announcements ?? 0) > 0,
  });

  const unviewedAnnouncements = announcements?.filter(a => !a.has_viewed).slice(0, 5) || [];

  const markViewedMutation = useMutation({
    mutationFn: markAnnouncementAsViewed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-counts'] });
      queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] });
      toast.success('Marked as viewed');
    },
  });

  const totalCount = counts?.total || 0;

  return (
    <>
      {/* Notification Icon with Badge */}
      <button
        onClick={() => setModalOpen(true)}
        className="relative p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
        title="View notifications"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {totalCount}
          </span>
        )}
      </button>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Notifications"
        size="lg"
      >
        {totalCount === 0 ? (
          <EmptyState
            icon={Bell}
            title="No pending notifications"
            description="You're all caught up!"
          />
        ) : (
          <div className="space-y-3">
            {/* Deadlines (Ministry Leaders only) */}
            {hasRole('ministry_leader') && counts && counts.deadlines > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <Clock className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink">Report Deadlines</h3>
                      <Badge tone="red">{counts.deadlines}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {counts.deadlines} deadline{counts.deadlines !== 1 ? 's' : ''} require{counts.deadlines === 1 ? 's' : ''} your attention
                    </p>
                    {/* Embedded deadline list */}
                    <div className="border-t border-slate-100 pt-3 -mb-1">
                      <ReportDeadlineNotifications 
                        variant="full"
                        onNavigateToSubmit={() => {
                          navigate('/submit-ministry-report');
                          setModalOpen(false);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Announcements */}
            {counts && counts.announcements > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Megaphone className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink">Recent Announcements</h3>
                      <Badge tone="purple">{counts.announcements}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {counts.announcements} unviewed announcement{counts.announcements !== 1 ? 's' : ''}
                    </p>
                    
                    {/* List of unviewed announcements */}
                    {unviewedAnnouncements.length > 0 && (
                      <div className="space-y-2 mb-3 border-t border-slate-100 pt-3">
                        {unviewedAnnouncements.map((announcement) => (
                          <div key={announcement.id} className="flex items-start justify-between gap-2 p-2 bg-slate-50 rounded">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{announcement.title}</p>
                              <p className="text-xs text-slate-500 truncate">{announcement.body.substring(0, 60)}...</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markViewedMutation.mutate(announcement.id)}
                              isLoading={markViewedMutation.isPending}
                              title="Mark as viewed"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigate('/announcements');
                        setModalOpen(false);
                      }}
                    >
                      View All
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Ministry Reports */}
            {counts && counts.ministryReports > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink">Unacknowledged Reports</h3>
                      <Badge tone="blue">{counts.ministryReports}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {counts.ministryReports} ministry report{counts.ministryReports !== 1 ? 's' : ''} awaiting your acknowledgement
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigate('/all-ministry-reports');
                        setModalOpen(false);
                      }}
                    >
                      View All
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Member Follow-ups */}
            {counts && counts.memberFollowUps > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Heart className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink">Pending Follow-ups</h3>
                      <Badge tone="amber">{counts.memberFollowUps}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {counts.memberFollowUps} member follow-up{counts.memberFollowUps !== 1 ? 's' : ''} need{counts.memberFollowUps === 1 ? 's' : ''} your attention
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigate('/all-member-followups');
                        setModalOpen(false);
                      }}
                    >
                      View All
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Budget Requests */}
            {counts && counts.budgets > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink">Pending Budget Approvals</h3>
                      <Badge tone="green">{counts.budgets}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {counts.budgets} budget request{counts.budgets !== 1 ? 's' : ''} awaiting review
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigate('/ministry-budgets');
                        setModalOpen(false);
                      }}
                    >
                      View All
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}