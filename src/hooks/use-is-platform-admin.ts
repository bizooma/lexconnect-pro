import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";

const PLATFORM_ADMIN_EMAILS = ["joe@bizooma.com"];

export function useIsPlatformAdmin() {
  const { user } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const byEmail = !!user?.email && PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase());
  return { isPlatformAdmin: isAdmin || byEmail, checking };
}
