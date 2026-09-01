import { useState } from 'react';
import { Bell, Megaphone, FileText, Heart, DollarSign } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { useNavigate } from 'react-router-dom';

export function NotificationsButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: counts } = useNotificationCounts();
  const navigate = useNavigate();

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
                      {counts.announcements} announcement{counts.announcements !== 1 ? 's' : ''} from the past 30 days
                    </p>
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
