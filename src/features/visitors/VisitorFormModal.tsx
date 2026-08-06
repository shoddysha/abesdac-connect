import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createVisitor, updateVisitor } from '@/services/visitors';
import { supabase } from '@/lib/supabase';

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  phone_number: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  visit_date: z.string().min(1, 'Required'),
  visit_type: z.enum(['sabbath_service', 'midweek_service', 'event']),
  followed_up: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function VisitorFormModal({
  open,
  visitorId,
  onClose,
  onSaved,
}: {
  open: boolean;
  visitorId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!visitorId;

  const visitorQuery = useQuery({
    queryKey: ['visitor', visitorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', visitorId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!visitorId && open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      visit_date: new Date().toISOString().slice(0, 10),
      visit_type: 'sabbath_service',
      followed_up: false,
    },
  });

  useEffect(() => {
    if (open && visitorQuery.data) {
      const v = visitorQuery.data;
      reset({
        first_name: v.first_name,
        last_name: v.last_name,
        phone_number: v.phone_number ?? '',
        email: v.email ?? '',
        visit_date: v.visit_date,
        visit_type: v.visit_type,
        followed_up: v.followed_up,
        notes: v.notes ?? '',
      });
    } else if (open && !visitorId) {
      reset({
        first_name: '',
        last_name: '',
        phone_number: '',
        email: '',
        visit_date: new Date().toISOString().slice(0, 10),
        visit_type: 'sabbath_service',
        followed_up: false,
        notes: '',
      });
    }
  }, [open, visitorId, visitorQuery.data, reset]);

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit) {
        await updateVisitor(visitorId!, values as any);
        toast.success('Visitor updated');
      } else {
        await createVisitor(values as any);
        toast.success('Visitor added');
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Visitor' : 'Add Visitor'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First name"
            {...register('first_name')}
            error={errors.first_name?.message}
          />
          <Input
            label="Last name"
            {...register('last_name')}
            error={errors.last_name?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone number"
            {...register('phone_number')}
            hint="Optional"
          />
          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            hint="Optional"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Visit date"
            type="date"
            {...register('visit_date')}
            error={errors.visit_date?.message}
          />
          <Select
            label="Visit type"
            {...register('visit_type')}
            options={[
              { value: 'sabbath_service', label: 'Sabbath Service' },
              { value: 'midweek_service', label: 'Midweek Service' },
              { value: 'event', label: 'Event' },
            ]}
          />
        </div>

        <Textarea
          label="Notes"
          rows={3}
          {...register('notes')}
          hint="Any additional information about the visitor"
        />

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            {...register('followed_up')}
            className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
          />
          Mark as followed up
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add Visitor'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
