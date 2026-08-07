-- =====================================================================
-- Migration: Add prayer_requests table
-- Tracks prayer requests from church members and visitors.
-- IDEMPOTENT — safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum for prayer request status
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE prayer_status AS ENUM ('open', 'ongoing', 'answered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id             UUID        REFERENCES public.members(id) ON DELETE SET NULL,
  requested_by          TEXT        NOT NULL, -- Name (for non-members or anonymous)
  request_text          TEXT        NOT NULL,
  status                prayer_status NOT NULL DEFAULT 'open',
  is_anonymous          BOOLEAN     NOT NULL DEFAULT FALSE,
  answered_at           TIMESTAMPTZ,
  answer_notes          TEXT,
  google_form_timestamp TEXT,       -- Timestamp from Google Form submission (for deduplication)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID        REFERENCES public.profiles(id)
);

COMMENT ON TABLE public.prayer_requests IS
  'Tracks prayer requests from members and visitors for intercessory prayer ministry.';

COMMENT ON COLUMN public.prayer_requests.google_form_timestamp IS
  'Timestamp from Google Form submission to prevent duplicate imports.';

-- ---------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prayer_requests_status
  ON public.prayer_requests (status);

CREATE INDEX IF NOT EXISTS idx_prayer_requests_member
  ON public.prayer_requests (member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prayer_requests_created
  ON public.prayer_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prayer_requests_google_timestamp
  ON public.prayer_requests (google_form_timestamp)
  WHERE google_form_timestamp IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. updated_at trigger
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prayer_requests_updated_at ON public.prayer_requests;
CREATE TRIGGER trg_prayer_requests_updated_at
  BEFORE UPDATE ON public.prayer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can view prayer requests
DROP POLICY IF EXISTS "prayer_requests_select_authenticated" ON public.prayer_requests;
CREATE POLICY "prayer_requests_select_authenticated"
  ON public.prayer_requests FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: any authenticated user can submit prayer requests
DROP POLICY IF EXISTS "prayer_requests_insert_authenticated" ON public.prayer_requests;
CREATE POLICY "prayer_requests_insert_authenticated"
  ON public.prayer_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: admins, pastors, and secretaries can update status/answers
DROP POLICY IF EXISTS "prayer_requests_update_authorized" ON public.prayer_requests;
CREATE POLICY "prayer_requests_update_authorized"
  ON public.prayer_requests FOR UPDATE
  USING  (public.current_role() IN ('administrator', 'pastor', 'secretary'))
  WITH CHECK (public.current_role() IN ('administrator', 'pastor', 'secretary'));

-- DELETE: administrators only
DROP POLICY IF EXISTS "prayer_requests_delete_admin" ON public.prayer_requests;
CREATE POLICY "prayer_requests_delete_admin"
  ON public.prayer_requests FOR DELETE
  USING (public.current_role() = 'administrator');
