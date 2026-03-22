-- Allow users to see who swiped on their own posts.
-- This is necessary to correctly calculate 'theyLikedYou' indicators on the inbox page.

CREATE POLICY "swipes_select_post_owners"
  ON "public"."swipes"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = swipes.post_id AND posts.user_id = auth.uid()
    )
  );
