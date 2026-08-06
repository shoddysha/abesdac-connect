import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { createMember } from '@/services/members';
import { deleteVisitor } from '@/services/visitors';
import { useAuth } from '@/contexts/AuthContext';
import type { Visitor } from '@/services/visitors';

export function PromoteToMemberModal({
  visitor,
  onClose,
  onSuccess,
}: {
  visitor: Visitor;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useAuth();
  const [isPromoting, setIsPromoting] = useState(false);

  async function handlePromote() {
    setIsPromoting(true);
    try {
      // Create new member with visitor info
      await createMember({
        first_name: visitor.first_name,
        last_name: visitor.last_name,
        phone: visitor.phone_number ?? null,
        email: visitor.email ?? null,
        date_joined: visitor.visit_date,
        status: 'active',
        created_by: profile?.id ?? null,
        // All other fields default to null/empty
        date_of_birth: null,
        gender: null,
        marital_status: null,
        occupation: null,
        nationality: null,
        alternate_phone: null,
        residential_address: null,
        gps_address: null,
        baptism_date: null,
        district: null,
        ministry_id: null,
        spouse_name: null,
        children_names: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        profile_image_url: null,
      } as any);

      // Delete visitor record
      await deleteVisitor(visitor.id);

      toast.success(`${visitor.first_name} ${visitor.last_name} promoted to member!`);
      onSuccess();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to promote visitor');
    } finally {
      setIsPromoting(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Promote to Member" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Are you sure you want to promote{' '}
          <strong className="text-ink">
            {visitor.first_name} {visitor.last_name}
          </strong>{' '}
          to a member?
        </p>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
          <p className="font-medium text-amber-900">What will happen:</p>
          <ul className="mt-2 space-y-1 text-amber-800 list-disc list-inside">
            <li>A new member profile will be created</li>
            <li>Visitor information (name, phone, email) will be transferred</li>
            <li>Join date will be set to their visit date</li>
            <li>The visitor record will be removed</li>
            <li>You can edit additional details in Members page</li>
          </ul>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePromote} isLoading={isPromoting}>
            Yes, Promote to Member
          </Button>
        </div>
      </div>
    </Modal>
  );
}
