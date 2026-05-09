
CREATE POLICY "Admins can view all mentorships"
ON public.mentorships FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create mentorships for any users"
ON public.mentorships FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any mentorships"
ON public.mentorships FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
