import { createFileRoute, redirect } from "@tanstack/react-router";

// The standalone AI builder was folded into the unified page-creation flow.
export const Route = createFileRoute("/app/website/ai")({
  beforeLoad: () => {
    throw redirect({ to: "/app/website/pages/new" });
  },
});
