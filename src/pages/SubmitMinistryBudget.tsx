import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { EmptyState, Spinner } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMinistries } from '@/services/ministries';
import { fetchEvents } from '@/services/events';
import {
  createMinistryBudget,
  generateBudgetPeriods,
  type BudgetItemInput,
} from '@/services/ministryBudgets';
import { format } from 'date-fns';

const budgetItemSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.coerce.number().min(0.01, 'Cost must be greater than 0'),
  category: z.string().optional(),
  priority: z.string().optional(),
});

const budgetSchema = z.object({
  title: z.string().min(1, 'Budget title is required'),
  description: z.string().optional(),
  period_type: z.enum(['monthly', 'quarterly', 'annual', 'special']),
  budget_period: z.string().optional(),
  event_id: z.string().optional(),
  items: z.array(budgetItemSchema).min(1, 'At least one item is required'),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

export function SubmitMinistryBudget() {
  const { profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canSubmit = hasRole('ministry_leader');

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  // Fetch events for special budgets
  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);
  const events = eventsQuery.data ?? [];

  const budgetForm = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      period_type: 'monthly',
      budget_period: '',
      event_id: '',
      items: [
        {
          item_name: '',
          description: '',
          quantity: 1,
          unit_cost: 0,
          category: '',
          priority: 'medium',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: budgetForm.control,
    name: 'items',
  });

  const periodType = budgetForm.watch('period_type');
  const budgetPeriods = generateBudgetPeriods(periodType as any);
  const items = budgetForm.watch('items');

  // Calculate total
  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unit_cost) || 0;
    return sum + (qty * cost);
  }, 0);

  function addItem() {
    append({
      item_name: '',
      description: '',
      quantity: 1,
      unit_cost: 0,
      category: '',
      priority: 'medium',
    });
  }

  async function onBudgetSubmit(values: BudgetFormValues) {
    if (!canSubmit || !profile || !userMinistry) return;

    // Validate period selection
    if (values.period_type !== 'special' && !values.budget_period) {
      toast.error('Please select a budget period');
      return;
    }

    if (values.period_type === 'special' && !values.event_id) {
      toast.error('Please select an event for special budget');
      return;
    }

    try {
      const input = {
        ministry_id: userMinistry.id,
        title: values.title,
        description: values.description,
        budget_period: values.period_type === 'special' 
          ? `Event: ${values.event_id}` 
          : values.budget_period || '',
        period_type: values.period_type as any,
        event_id: values.period_type === 'special' ? values.event_id : undefined,
        items: values.items.map((item) => ({
          item_name: item.item_name,
          description: item.description,
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          category: item.category,
          priority: item.priority,
        })),
      };

      await createMinistryBudget(input, profile.id);
      toast.success('Budget submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['ministry-budgets'] });
      navigate('/ministry-dashboard');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (ministriesQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Submit Ministry Budget</h1>
        <Spinner />
      </div>
    );
  }

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ministry-dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-ink">Submit Ministry Budget</h1>
        </div>
        <EmptyState
          icon={DollarSign}
          title="No ministry assigned"
          description="Contact an administrator to assign you as a ministry leader"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ministry-dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink">Submit Ministry Budget</h1>
            <p className="text-sm text-slate-500">{userMinistry.name}</p>
          </div>
        </div>
      </div>

      <form onSubmit={budgetForm.handleSubmit(onBudgetSubmit)} className="space-y-5">
        {/* Budget Info Card */}
        <Card>
          <h3 className="text-lg font-semibold text-ink mb-4">Budget Information</h3>
          <div className="space-y-4">
            <Input
              label="Budget Title"
              placeholder="e.g., Youth Ministry Q1 Budget"
              {...budgetForm.register('title')}
              error={budgetForm.formState.errors.title?.message}
            />

            <Textarea
              label="Description (Optional)"
              placeholder="Brief description of budget purpose"
              rows={2}
              {...budgetForm.register('description')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Budget Type"
                options={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'quarterly', label: 'Quarterly' },
                  { value: 'annual', label: 'Annual' },
                  { value: 'special', label: 'Special (Event-based)' },
                ]}
                {...budgetForm.register('period_type')}
              />

              {periodType === 'special' ? (
                <Select
                  label="Select Event"
                  options={[
                    { value: '', label: 'Select an event' },
                    ...events.map((e: any) => ({
                      value: e.id,
                      label: `${e.title} - ${format(new Date(e.start_time), 'MMM d, yyyy')}`,
                    })),
                  ]}
                  {...budgetForm.register('event_id')}
                />
              ) : (
                <Select
                  label="Budget Period"
                  options={[
                    { value: '', label: 'Select period' },
                    ...budgetPeriods.map((p) => ({ value: p, label: p })),
                  ]}
                  {...budgetForm.register('budget_period')}
                  error={budgetForm.formState.errors.budget_period?.message}
                />
              )}
            </div>
          </div>
        </Card>

        {/* Budget Items Card */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-ink">Budget Items</h3>
            <Button type="button" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-ink">Item #{index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Item Name"
                    placeholder="e.g., Sound System"
                    {...budgetForm.register(`items.${index}.item_name`)}
                    error={budgetForm.formState.errors.items?.[index]?.item_name?.message}
                  />

                  <Select
                    label="Category (Optional)"
                    options={[
                      { value: '', label: 'Select category' },
                      { value: 'equipment', label: 'Equipment' },
                      { value: 'materials', label: 'Materials' },
                      { value: 'refreshments', label: 'Refreshments' },
                      { value: 'transportation', label: 'Transportation' },
                      { value: 'venue', label: 'Venue/Rental' },
                      { value: 'printing', label: 'Printing' },
                      { value: 'other', label: 'Other' },
                    ]}
                    {...budgetForm.register(`items.${index}.category`)}
                  />
                </div>

                <Textarea
                  label="Description (Optional)"
                  placeholder="Additional details"
                  rows={2}
                  {...budgetForm.register(`items.${index}.description`)}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    type="number"
                    label="Quantity"
                    placeholder="1"
                    min="1"
                    {...budgetForm.register(`items.${index}.quantity`)}
                    error={budgetForm.formState.errors.items?.[index]?.quantity?.message}
                  />

                  <Input
                    type="number"
                    step="0.01"
                    label="Unit Cost (GH₵)"
                    placeholder="0.00"
                    {...budgetForm.register(`items.${index}.unit_cost`)}
                    error={budgetForm.formState.errors.items?.[index]?.unit_cost?.message}
                  />

                  <Select
                    label="Priority"
                    options={[
                      { value: 'high', label: 'High' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'low', label: 'Low' },
                    ]}
                    {...budgetForm.register(`items.${index}.priority`)}
                  />
                </div>

                {/* Item subtotal */}
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium text-right">
                    Subtotal: GH₵
                    {(
                      (Number(items[index]?.quantity) || 0) *
                      (Number(items[index]?.unit_cost) || 0)
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {budgetForm.formState.errors.items?.root && (
            <p className="text-sm text-red-600 mt-2">
              {budgetForm.formState.errors.items.root.message}
            </p>
          )}
        </Card>

        {/* Total and Submit */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Total Budget Request</h3>
              <p className="text-3xl font-bold text-primary mt-1">
                GH₵{totalAmount.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/ministry-dashboard')}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={budgetForm.formState.isSubmitting}>
                <DollarSign className="h-4 w-4" />
                Submit Budget
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
