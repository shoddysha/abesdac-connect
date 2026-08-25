-- Add acknowledgement fields to ministry_reports table

alter table public.ministry_reports
add column if not exists acknowledged_at timestamptz,
add column if not exists acknowledged_by uuid references public.profiles(id) on delete set null,
add column if not exists acknowledgement_note text;

-- Create index for faster queries
create index if not exists idx_ministry_reports_acknowledged_at on public.ministry_reports(acknowledged_at);
