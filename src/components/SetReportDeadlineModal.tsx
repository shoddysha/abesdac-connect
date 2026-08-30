import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createReportDeadline } from '@/services/reportDeadlines';
import { fetchMinistries } from '@/services/ministries';
import { useAuth } from '@/contexts/AuthContext';
import type { ReportType } from '@/types/database';

const deadlineSchema = z.object({
  ministry_id: z.string().min(1, 'Ministry is required'),
  report_type: z.enum(['monthly', 'quarterly', 'annual', 'special']),
  report_period: z.string().min(1, 'Report period is required'),
  deadline_date: z.string().min(1, 'Deadline date is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
});

type DeadlineFormValues = z.infer<typeof deadlineSchema>;

interface SetReportDeadlineModalProps {
  open: boolean;
  onClose: () => void;
}

export function SetReportDeadlineModal({ open, onClose }: SetReportDeadlineModalProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DeadlineFormValues>({
    resolver: zodResolver(deadlineSchema),
    defaultValues: {
      report_type: 'monthly',
    },
  });

  const reportType = watch('report_type');

  const createMutation = useMutation({
    mutationFn: (values: DeadlineFormValues) =>
      createReportDeadline(
        values.ministry_id,
        values.report_type as ReportType,
        values.report_period,
        values.deadline_date,
        values.title,
        values.description,
        profile?.id
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['deadline-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-deadlines'] });
      toast.success('Report deadline created successfully! Ministry leaders have been notified.');
      reset();
      onClose();
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('A deadline already exists for this ministry, report type, and period');
      } else {
        toast.error(error.message);
      }
    },
  });

  const onSubmit = (values: DeadlineFormValues) => {
    createMutation.mutate(values);
  };

  // Generate period suggestions based on report type
  const getPeriodPlaceholder = () => {
    switch (reportType) {
      case 'monthly':
        return 'e.g., 2024-01, January 2024';
      case 'quarterly':
        return 'e.g., Q1 2024, 2024 Q2';
      case 'annual':
        return 'e.g., 2024, FY2024';
      case 'special':
        return 'e.g., Easter Convention 2024';
      default:
        return '';
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Set Report Deadline">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Select
          label="Ministry"
          {...register('ministry_id')}
          error={errors.ministry_id?.message}
          options={[
            { value: '', label: 'Select ministry...' },
            ...(ministriesQuery.data || []).map((m: any) => ({
              value: m.id,
              label: m.name,
            })),
          ]}
        />

        <Select
          label="Report Type"
          {...register('report_type')}
          error={errors.report_type?.message}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'annual', label: 'Annual' },
            { value: 'special', label: 'Special' },
          ]}
        />

        <Input
          label="Report Period"
          {...register('report_period')}
          error={errors.report_period?.message}
          placeholder={getPeriodPlaceholder()}
          hint="Specify the period this report should cover"
        />

        <Input
          label="Deadline Date"
          type="datetime-local"
          {...register('deadline_date')}
          error={errors.deadline_date?.message}
          hint="Ministry leaders will be notified about this deadline"
        />

        <Input
          label="Title"
          {...register('title')}
          error={errors.title?.message}
          placeholder="e.g., Monthly Ministry Report - January 2024"
        />

        <Textarea
          label="Description (Optional)"
          {...register('description')}
          error={errors.description?.message}
          placeholder="Add any specific instructions or requirements for this report..."
          rows={3}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting || createMutation.isPending}>
            Create Deadline
          </Button>
        </div>
      </form>
    </Modal>
  );
}
