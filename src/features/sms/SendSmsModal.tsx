import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';
import { fetchMinistries } from '@/services/ministries';
import { fetchMembers } from '@/services/members';
import { sendBulkSms } from '@/services/sms';
import type { RecipientFilters, SmsType } from '@/types/database';
import { MessageSquare, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface SendSmsModalProps {
  open: boolean;
  onClose: () => void;
  defaultMessage?: string;
  smsType: SmsType;
  eventId?: string;
  announcementId?: string;
  onSuccess?: () => void;
}

type RecipientType = 'all' | 'ministry' | 'manual';

export function SendSmsModal({
  open,
  onClose,
  defaultMessage = '',
  smsType,
  eventId,
  announcementId,
  onSuccess,
}: SendSmsModalProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [recipientType, setRecipientType] = useState<RecipientType>('all');
  const [selectedMinistry, setSelectedMinistry] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);

  const { data: ministries = [] } = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', recipientType === 'manual'],
    queryFn: () => fetchMembers({}),
    enabled: recipientType === 'manual',
  });

  // Calculate recipient count
  useEffect(() => {
    async function calculateCount() {
      if (recipientType === 'all') {
        const allMembers = await fetchMembers({});
        // Filter for active, non-archived members with phone numbers
        const eligible = allMembers.filter((m) => 
          m.status === 'active' && 
          !m.is_archived && 
          m.phone && 
          m.phone.trim() !== ''
        );
        setRecipientCount(eligible.length);
      } else if (recipientType === 'ministry' && selectedMinistry) {
        const ministryMembers = await fetchMembers({ ministryId: selectedMinistry });
        const eligible = ministryMembers.filter((m) => 
          m.status === 'active' && 
          !m.is_archived && 
          m.phone && 
          m.phone.trim() !== ''
        );
        setRecipientCount(eligible.length);
      } else if (recipientType === 'manual') {
        setRecipientCount(selectedMembers.length);
      } else {
        setRecipientCount(0);
      }
    }
    calculateCount();
  }, [recipientType, selectedMinistry, selectedMembers]);

  // Update message when defaultMessage changes
  useEffect(() => {
    setMessage(defaultMessage);
  }, [defaultMessage]);

  const messageLength = message.length;
  const smsCount = Math.ceil(messageLength / 160);

  async function handleSend() {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (recipientCount === 0) {
      toast.error('No recipients selected');
      return;
    }

    const filters: RecipientFilters = {};

    if (recipientType === 'all') {
      filters.all_members = true;
    } else if (recipientType === 'ministry' && selectedMinistry) {
      filters.ministry_id = selectedMinistry;
    } else if (recipientType === 'manual' && selectedMembers.length > 0) {
      filters.member_ids = selectedMembers;
    } else {
      toast.error('Please select recipients');
      return;
    }

    setIsSending(true);

    try {
      const result = await sendBulkSms(message, filters, smsType, eventId, announcementId);

      if (result.success) {
        toast.success(result.message);
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error((error as Error).message || 'Failed to send SMS');
    } finally {
      setIsSending(false);
    }
  }

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Send SMS" size="lg">
      <div className="space-y-4">
        {/* Message Input */}
        <div>
          <Textarea
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            rows={5}
            maxLength={500}
          />
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              {messageLength} characters ({smsCount} SMS)
            </span>
            {messageLength > 160 && (
              <span className="text-amber-600">Message will be split into {smsCount} parts</span>
            )}
          </div>
        </div>

        {/* Recipient Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Recipients</label>
          <div className="space-y-3">
            {/* Recipient Type Selection */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRecipientType('all')}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                  recipientType === 'all'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Users className="h-5 w-5" />
                <span className="text-xs font-medium">All Members</span>
              </button>

              <button
                type="button"
                onClick={() => setRecipientType('ministry')}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                  recipientType === 'ministry'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <MessageSquare className="h-5 w-5" />
                <span className="text-xs font-medium">By Ministry</span>
              </button>

              <button
                type="button"
                onClick={() => setRecipientType('manual')}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                  recipientType === 'manual'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-xs font-medium">Select Members</span>
              </button>
            </div>

            {/* Ministry Selector */}
            {recipientType === 'ministry' && (
              <Select
                value={selectedMinistry}
                onChange={(e) => setSelectedMinistry(e.target.value)}
                options={ministries.map((m) => ({ value: m.id, label: m.name }))}
                placeholder="Select a ministry"
              />
            )}

            {/* Manual Member Selection */}
            {recipientType === 'manual' && (
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {members.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">Loading members...</p>
                ) : (
                  members
                    .filter((m) => m.phone) // Only show members with phone numbers
                    .map((member) => (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleMemberToggle(member.id)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium text-ink">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-xs text-slate-500">{member.phone}</div>
                        </div>
                      </label>
                    ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recipient Count & Warning */}
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
            <div className="text-sm text-slate-600">
              <p className="font-medium">
                Ready to send to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
              </p>
              <p className="mt-1 text-xs">
                This will send approximately {recipientCount * smsCount} SMS message
                {recipientCount * smsCount !== 1 ? 's' : ''}.
                {recipientCount * smsCount > 100 && (
                  <span className="text-amber-600"> This is a large batch - please confirm before sending.</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} isLoading={isSending} disabled={recipientCount === 0 || !message.trim()}>
            <MessageSquare className="h-4 w-4" />
            Send SMS
          </Button>
        </div>
      </div>
    </Modal>
  );
}
