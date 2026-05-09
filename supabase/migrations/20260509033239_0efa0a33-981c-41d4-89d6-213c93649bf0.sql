
REVOKE EXECUTE ON FUNCTION public.notify_mentorship_requested() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_mentorship_active() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_message() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_meeting_scheduled() FROM PUBLIC, authenticated, anon;
