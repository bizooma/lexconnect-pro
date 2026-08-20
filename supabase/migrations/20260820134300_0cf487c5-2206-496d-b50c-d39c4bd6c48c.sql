DROP POLICY IF EXISTS "website-media public read" ON storage.objects;

CREATE POLICY "website-media list by content editor"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'website-media'
    AND public.can_edit_website(((storage.foldername(name))[1])::uuid, auth.uid())
  );