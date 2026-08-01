import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createMember, fetchMember, updateMember } from '@/services/members';
import { fetchMinistries } from '@/services/ministries';
import { uploadMemberImage } from '@/services/storage';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  occupation: z.string().optional(),
  nationality: z.string().optional(),
  phone: z.string().optional(),
  alternate_phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  residential_address: z.string().optional(),
  gps_address: z.string().optional(),
  baptism_date: z.string().optional(),
  date_joined: z.string().min(1, 'Required'),
  district: z.string().optional(),
  ministry_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived', 'transferred', 'deceased']),
  spouse_name: z.string().optional(),
  children_names: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  first_name: '',
  last_name: '',
  date_joined: new Date().toISOString().slice(0, 10),
  status: 'active',
};

export function MemberFormModal({
  open,
  memberId,
  onClose,
  onSaved,
}: {
  open: boolean;
  memberId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const isEdit = !!memberId;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const memberQuery = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => fetchMember(memberId!),
    enabled: !!memberId && open,
  });
  const ministriesQuery = useQuery({ queryKey: ['ministries'], queryFn: fetchMinistries });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open && memberQuery.data) {
      const m = memberQuery.data;
      reset({
        first_name: m.first_name,
        last_name: m.last_name,
        date_of_birth: m.date_of_birth ?? '',
        gender: m.gender ?? undefined,
        marital_status: m.marital_status ?? undefined,
        occupation: m.occupation ?? '',
        nationality: m.nationality ?? '',
        phone: m.phone ?? '',
        alternate_phone: m.alternate_phone ?? '',
        email: m.email ?? '',
        residential_address: m.residential_address ?? '',
        gps_address: m.gps_address ?? '',
        baptism_date: m.baptism_date ?? '',
        date_joined: m.date_joined,
        district: m.district ?? '',
        ministry_id: m.ministry_id ?? '',
        status: m.status,
        spouse_name: m.spouse_name ?? '',
        children_names: m.children_names ?? '',
        emergency_contact_name: m.emergency_contact_name ?? '',
        emergency_contact_phone: m.emergency_contact_phone ?? '',
      });
      setImagePreview(m.profile_image_url);
    } else if (open && !memberId) {
      reset(defaultValues);
      setImagePreview(null);
      setImageFile(null);
    }
  }, [open, memberId, memberQuery.data, reset]);

  const ministryOptions = useMemo(
    () => (ministriesQuery.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    [ministriesQuery.data]
  );

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: FormValues) {
    try {
      let profile_image_url = imagePreview && !imageFile ? imagePreview : undefined;

      if (isEdit) {
        if (imageFile) {
          profile_image_url = await uploadMemberImage(imageFile, memberQuery.data!.member_code);
        }
        await updateMember(memberId!, {
          ...values,
          ministry_id: values.ministry_id || null,
          email: values.email || null,
          profile_image_url,
          updated_by: profile?.id,
        } as any);
        toast.success('Member updated');
      } else {
        const created = await createMember({
          ...values,
          ministry_id: values.ministry_id || null,
          email: values.email || null,
          created_by: profile?.id,
        } as any);
        if (imageFile) {
          const url = await uploadMemberImage(imageFile, created.member_code);
          await updateMember(created.id, { profile_image_url: url });
        }
        toast.success('Member added');
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit member' : 'Add member'} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-slate-400">Photo</span>
            )}
          </div>
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50">
            Upload photo
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-primary">Personal information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="First name" {...register('first_name')} error={errors.first_name?.message} />
            <Input label="Last name" {...register('last_name')} error={errors.last_name?.message} />
            <Input label="Date of birth" type="date" {...register('date_of_birth')} />
            <Select
              label="Gender"
              placeholder="Select gender"
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              {...register('gender')}
            />
            <Select
              label="Marital status"
              placeholder="Select status"
              options={[
                { value: 'single', label: 'Single' },
                { value: 'married', label: 'Married' },
                { value: 'divorced', label: 'Divorced' },
                { value: 'widowed', label: 'Widowed' },
              ]}
              {...register('marital_status')}
            />
            <Input label="Occupation" {...register('occupation')} />
            <Input label="Nationality" {...register('nationality')} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-primary">Contact information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Phone number" {...register('phone')} />
            <Input label="Alternate phone" {...register('alternate_phone')} />
            <Input label="Email address" type="email" {...register('email')} error={errors.email?.message} />
            <Textarea label="Residential address" className="lg:col-span-2" {...register('residential_address')} />
            <Input label="GPS address" {...register('gps_address')} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-primary">Church information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Baptism date" type="date" {...register('baptism_date')} />
            <Input label="Date joined" type="date" {...register('date_joined')} error={errors.date_joined?.message} />
            <Input label="District" {...register('district')} />
            <Select
              label="Ministry"
              placeholder="No ministry"
              options={[{ value: '', label: 'No ministry' }, ...ministryOptions]}
              {...register('ministry_id')}
            />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'transferred', label: 'Transferred' },
                { value: 'deceased', label: 'Deceased' },
                { value: 'archived', label: 'Archived' },
              ]}
              {...register('status')}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-primary">Family information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Spouse" {...register('spouse_name')} />
            <Input label="Children" hint="Comma-separated names" {...register('children_names')} />
            <Input label="Emergency contact name" {...register('emergency_contact_name')} />
            <Input label="Emergency contact phone" {...register('emergency_contact_phone')} />
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Add member'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
