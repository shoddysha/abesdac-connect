-- =====================================================================
-- Migration: Add visitors table
-- Tracks first-time church visitors for pastoral follow-up.
-- IDEMPOTENT — safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visitors (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name    TEXT        NOT NULL,
  last_name     TEXT        NOT NULL,
  phone_number  TEXT,
  email         TEXT,
  visit_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  visit_type    TEXT        NOT NULL DEFAULT 'sabbath_service'
                            CHECK (visit_type IN ('sabbath_service', 'midweek_service', 'event')),
  followed_up   BOOLEAN     NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.visitors IS
  'Tracks first-time church visitors for follow-up and outreach.';

-- ---------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_visitors_visit_date
  ON public.visitors (visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_visitors_not_followed_up
  ON public.visitors (followed_up)
  WHERE followed_up = FALSE;

-- ---------------------------------------------------------------------
-- 3. updated_at trigger  (uses the same function as every other table)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_visitors_updated_at ON public.visitors;
CREATE TRIGGER trg_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- SELECT: any signed-in user can see visitors
DROP POLICY IF EXISTS "visitors_select_authenticated" ON public.visitors;
CREATE POLICY "visitors_select_authenticated"
  ON public.visitors FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: administrators and secretaries only
DROP POLICY IF EXISTS "visitors_insert_admin_secretary" ON public.visitors;
CREATE POLICY "visitors_insert_admin_secretary"
  ON public.visitors FOR INSERT
  WITH CHECK (public.current_role() IN ('administrator', 'secretary'));

-- UPDATE: administrators and secretaries only
DROP POLICY IF EXISTS "visitors_update_admin_secretary" ON public.visitors;
CREATE POLICY "visitors_update_admin_secretary"
  ON public.visitors FOR UPDATE
  USING  (public.current_role() IN ('administrator', 'secretary'))
  WITH CHECK (public.current_role() IN ('administrator', 'secretary'));

-- DELETE: administrators only
DROP POLICY IF EXISTS "visitors_delete_admin" ON public.visitors;
CREATE POLICY "visitors_delete_admin"
  ON public.visitors FOR DELETE
  USING (public.current_role() = 'administrator');
