import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createPrayerRequest } from '@/services/prayerRequests';
import { fetchAllMembers } from '@/services/members';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  member_id: z.string().optional(),
  requested_by: z.string().min(1, 'Name is required'),
  request_text: z.string().min(10, 'Please provide more details (at least 10 characters)'),
  is_anonymous: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function PrayerRequestFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [linkToMember, setLinkToMember] = useState(false);

  const membersQuery = useQuery({
    queryKey: ['members-all'],
    queryFn: fetchAllMembers,
    enabled: linkToMember,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requested_by: '',
      request_text: '',
      is_anonymous: false,
    },
  });

  const isAnonymous = watch('is_anonymous');

  async function onSubmit(values: FormValues) {
    try {
      await createPrayerRequest({
        member_id: linkToMember && values.member_id ? values.member_id : null,
        requested_by: values.is_anonymous ? 'Anonymous' : values.requested_by,
        request_text: values.request_text,
        is_anonymous: values.is_anonymous,
        created_by: profile?.id ?? null,
      });
      toast.success('Prayer request submitted');
      reset();
      setLinkToMember(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleClose() {
    reset();
    setLinkToMember(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Submit Prayer Request" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            {...register('is_anonymous')}
            className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
          />
          Submit anonymously
        </label>

        {!isAnonymous && (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={linkToMember}
                onChange={(e) => setLinkToMember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
              />
              Link to existing member
            </label>

            {linkToMember ? (
              <Select
                label="Select Member"
                {...register('member_id')}
                options={[
                  { value: '', label: '-- Select member --' },
                  ...(membersQuery.data ?? []).map((m) => ({
                    value: m.id,
                    label: `${m.first_name} ${m.last_name}`,
                  })),
                ]}
              />
            ) : (
              <Input
                label="Your name"
                {...register('requested_by')}
                error={errors.requested_by?.message}
                placeholder="Enter your full name"
              />
            )}
          </>
        )}

        <Textarea
          label="Prayer request"
          rows={6}
          {...register('request_text')}
          error={errors.request_text?.message}
          placeholder="Share your prayer request in detail…"
        />

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
          <p className="font-medium mb-1">Your request will be:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Reviewed by our pastoral team</li>
            <li>Included in intercessory prayer sessions</li>
            <li>Kept confidential within the prayer ministry</li>
            {isAnonymous && <li className="font-medium">Submitted anonymously</li>}
          </ul>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Submit Prayer Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
