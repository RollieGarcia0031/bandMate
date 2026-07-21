-- Migration: Grant privileges and create RLS policy for keep_alive table
GRANT ALL ON TABLE public.keep_alive TO postgres, anon, authenticated, service_role;

DROP POLICY IF EXISTS "allow_all_keep_alive" ON public.keep_alive;
CREATE POLICY "allow_all_keep_alive" ON public.keep_alive FOR ALL USING (true) WITH CHECK (true);
