import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updatePrayerRequest, type PrayerRequest } from '@/services/prayerRequests';

const schema = z.object({
  answer_notes: z.string().min(5, 'Please provide details about how this prayer was answered'),
});

type FormValues = z.infer<typeof schema>;

export function PrayerAnswerModal({
  request,
  onClose,
  onSaved,
}: {
  request: PrayerRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      answer_notes: request.answer_notes ?? '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await updatePrayerRequest(request.id, {
        status: 'answered',
        answer_notes: values.answer_notes,
      });
      toast.success('Prayer marked as answered');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Mark Prayer as Answered" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-700 mb-1">Prayer Request:</p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{request.request_text}</p>
        </div>

        <Textarea
          label="How was this prayer answered?"
          rows={5}
          {...register('answer_notes')}
          error={errors.answer_notes?.message}
          placeholder="Share the testimony of how God answered this prayer…"
        />

        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <p className="font-medium mb-1">Give thanks and glory to God!</p>
          <p className="text-xs">
            This testimony will be recorded and can be shared to encourage others in their faith.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Mark as Answered
          </Button>
        </div>
      </form>
    </Modal>
  );
}
