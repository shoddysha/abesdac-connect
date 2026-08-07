import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HandHeart, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { createPrayerRequest } from '@/services/prayerRequests';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  request: z.string().min(10, 'Please provide more details (at least 10 characters)'),
  anonymous: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function PublicPrayerRequest() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      request: '',
      anonymous: false,
    },
  });

  const isAnonymous = watch('anonymous');

  async function onSubmit(values: FormValues) {
    try {
      await createPrayerRequest({
        requested_by: values.anonymous ? 'Anonymous' : values.name,
        request_text: values.request,
        is_anonymous: values.anonymous,
      });

      setSubmitted(true);
      reset();

      // Reset success message after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      toast.error('Failed to submit prayer request. Please try again.');
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/abeka.png"
              alt="Abeka SDA Church"
              className="h-20 w-20 rounded-xl bg-white shadow-lg p-2"
            />
          </div>
          <h1 className="text-3xl font-bold text-ink mb-2">Prayer Request</h1>
          <p className="text-slate-600">
            Abeka Seventh-day Adventist Church
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {submitted ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-ink mb-2">
                Prayer Request Submitted
              </h2>
              <p className="text-slate-600 mb-6">
                Thank you for sharing your prayer request with us. Our pastoral team will lift you up in prayer.
              </p>
              <Button onClick={() => setSubmitted(false)} variant="outline">
                Submit Another Request
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-200">
                <div className="rounded-lg bg-secondary-100 p-3">
                  <HandHeart className="h-6 w-6 text-secondary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink">Share Your Prayer Request</h2>
                  <p className="text-sm text-slate-500">
                    We believe in the power of prayer
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                  <p className="font-medium mb-2">Your prayer request will be:</p>
                  <ul className="space-y-1 text-xs">
                    <li>✓ Reviewed by our pastoral team</li>
                    <li>✓ Included in our intercessory prayer sessions</li>
                    <li>✓ Kept confidential within the prayer ministry</li>
                    <li>✓ Handled with care and compassion</li>
                  </ul>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    id="anonymous"
                    {...register('anonymous')}
                    className="h-5 w-5 rounded border-slate-300 text-secondary focus:ring-secondary cursor-pointer"
                  />
                  <label htmlFor="anonymous" className="text-sm font-medium text-ink cursor-pointer flex-1">
                    Submit this prayer request anonymously
                    <span className="block text-xs text-slate-500 font-normal mt-0.5">
                      Your name will not be shown to the prayer team
                    </span>
                  </label>
                </div>

                {!isAnonymous && (
                  <Input
                    label="Your Name"
                    placeholder="Enter your full name"
                    {...register('name')}
                    error={errors.name?.message}
                  />
                )}

                <Textarea
                  label="Prayer Request"
                  rows={8}
                  placeholder="Share your prayer request in detail... Our pastoral team will lift you up in prayer."
                  {...register('request')}
                  error={errors.request?.message}
                />

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">Scripture Encouragement:</p>
                  <p className="italic text-xs">
                    "Do not be anxious about anything, but in every situation, by prayer and petition, 
                    with thanksgiving, present your requests to God." - Philippians 4:6
                  </p>
                </div>

                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  className="w-full py-3 text-base"
                >
                  <HandHeart className="h-5 w-5" />
                  Submit Prayer Request
                </Button>

                <p className="text-center text-xs text-slate-500">
                  This form is secure and your information is kept confidential
                </p>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-500">
          <p>Abeka Seventh-day Adventist Church</p>
          <p className="mt-1">We're praying with you and for you</p>
        </div>
      </div>
    </div>
  );
}
