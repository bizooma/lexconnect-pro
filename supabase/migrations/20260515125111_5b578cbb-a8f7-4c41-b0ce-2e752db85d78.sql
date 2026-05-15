-- Public bucket for website media (hero images, OG images, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('website-media', 'website-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access (needed for OG image crawlers + public pages)
CREATE POLICY "website-media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'website-media');

-- Org content editors can upload under their org folder (folder = organization_id)
CREATE POLICY "website-media insert by content editor"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'website-media'
  AND public.can_edit_website(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "website-media update by content editor"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'website-media'
  AND public.can_edit_website(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "website-media delete by content editor"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'website-media'
  AND public.can_edit_website(((storage.foldername(name))[1])::uuid, auth.uid())
);