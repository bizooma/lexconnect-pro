ALTER POLICY "Participants can view conversations" ON public.conversations
  USING (is_conversation_participant(id, auth.uid()));

ALTER POLICY "Org admins manage invite codes" ON public.invite_codes
  USING (is_org_admin(organization_id, auth.uid()))
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

ALTER POLICY "Host or attendee view meetings" ON public.meetings
  USING (((auth.uid() = host_id) OR (auth.uid() = attendee_id))
         AND is_org_member(organization_id, auth.uid()));

ALTER POLICY "Org members view mentorships in their org" ON public.mentorships
  USING ((((auth.uid() = mentor_id) OR (auth.uid() = mentee_id))
          AND is_org_member(organization_id, auth.uid()))
         OR is_org_admin(organization_id, auth.uid()));

ALTER POLICY "Participants or org admins update mentorships" ON public.mentorships
  USING (org_can_write(organization_id)
         AND ((auth.uid() = mentor_id) OR (auth.uid() = mentee_id)
              OR is_org_admin(organization_id, auth.uid())));

ALTER POLICY "Org admins manage invites" ON public.organization_invites
  USING (is_org_admin(organization_id, auth.uid()))
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

ALTER POLICY "Org admins can remove members" ON public.organization_members
  USING (is_org_admin(organization_id, auth.uid()));

ALTER POLICY "Org admins can add members" ON public.organization_members
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

ALTER POLICY "Members can view their org membership rows" ON public.organization_members
  USING (is_org_member(organization_id, auth.uid()));

ALTER POLICY "Org admins can update members" ON public.organization_members
  USING (is_org_admin(organization_id, auth.uid()));

ALTER POLICY "Members can view their organizations" ON public.organizations
  USING (is_org_member(id, auth.uid()));

ALTER POLICY "Org admins can update their organization" ON public.organizations
  USING (is_org_admin(id, auth.uid()));

ALTER POLICY "Profiles viewable by org members" ON public.profiles
  USING (is_org_member(organization_id, auth.uid()) OR (auth.uid() = user_id));

ALTER POLICY "qa_categories_admin_all" ON public.qa_categories
  USING (is_org_admin(organization_id, auth.uid()))
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

ALTER POLICY "qa_categories_select" ON public.qa_categories
  USING (is_org_member(organization_id, auth.uid()));

ALTER POLICY "qa_posts_delete" ON public.qa_posts
  USING ((auth.uid() = author_id) OR is_org_admin(organization_id, auth.uid()));

ALTER POLICY "qa_posts_select" ON public.qa_posts
  USING (is_org_member(organization_id, auth.uid()));

ALTER POLICY "qa_posts_update" ON public.qa_posts
  USING ((auth.uid() = author_id) OR is_org_admin(organization_id, auth.uid()));

ALTER POLICY "qa_replies_delete" ON public.qa_replies
  USING ((auth.uid() = author_id) OR is_org_admin(organization_id, auth.uid()));

ALTER POLICY "qa_replies_update" ON public.qa_replies
  USING ((auth.uid() = author_id) OR is_org_admin(organization_id, auth.uid()));

ALTER POLICY "Org members can view their subscription" ON public.subscriptions
  USING (is_org_member(organization_id, auth.uid()));

ALTER POLICY "website_ai_select" ON public.website_ai_generations USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "website_brand_select" ON public.website_brand_settings USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "wcd_select" ON public.website_custom_domains USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "Org members can view analytics" ON public.website_page_views USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "website_pages_select" ON public.website_pages USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "website_publish_hist_select" ON public.website_publish_history USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "website_saved_select" ON public.website_saved_sections USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "website_sections_select" ON public.website_sections USING (is_org_member(organization_id, auth.uid()));

ALTER POLICY "website_templates_select" ON public.website_templates
  USING ((is_global = true)
         OR ((organization_id IS NOT NULL) AND is_org_member(organization_id, auth.uid())));

ALTER POLICY "website_templates_write" ON public.website_templates
  USING (((is_global = true) AND has_role(auth.uid(), 'admin'::app_role))
         OR ((is_global = false) AND (organization_id IS NOT NULL)
             AND can_edit_website(organization_id, auth.uid())))
  WITH CHECK (((is_global = true) AND has_role(auth.uid(), 'admin'::app_role))
         OR ((is_global = false) AND (organization_id IS NOT NULL)
             AND can_edit_website(organization_id, auth.uid())
             AND org_can_write(organization_id)));