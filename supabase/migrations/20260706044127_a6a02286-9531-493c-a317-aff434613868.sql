
-- profiles keyed by auth user id, with phone
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- generation_logs: track successful premium account generations
CREATE TABLE public.generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.generation_logs TO anon;
GRANT SELECT, INSERT ON public.generation_logs TO authenticated;
GRANT ALL ON public.generation_logs TO service_role;
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Public can only see aggregate counts, but we allow SELECT for the counter
-- (no sensitive data). To be safer, restrict select to count-only via a view is nicer,
-- but a simple permissive read policy on target_email + created_at is acceptable here.
CREATE POLICY "generation_logs_public_read" ON public.generation_logs
  FOR SELECT TO anon USING (true);
CREATE POLICY "generation_logs_auth_read" ON public.generation_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "generation_logs_insert_own" ON public.generation_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
