insert into storage.buckets (id, name, public) values ('org-logos','org-logos',true) on conflict (id) do nothing;

create policy "Org logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'org-logos');

create policy "Org admins can upload org logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Org admins can update org logos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'org-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Org admins can delete org logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  );