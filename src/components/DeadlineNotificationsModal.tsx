import { Modal } from '@/components/ui/Modal';
import { ReportDeadlineNotifications } from '@/components/ReportDeadlineNotifications';

interface DeadlineNotificationsModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateToSubmit?: () => void;
}

export function DeadlineNotificationsModal({
  open,
  onClose,
  onNavigateToSubmit,
}: DeadlineNotificationsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Report Deadlines" size="lg">
      <ReportDeadlineNotifications 
        variant="full"
        onNavigateToSubmit={onNavigateToSubmit}
      />
    </Modal>
  );
}
