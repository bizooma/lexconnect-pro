import { supabase } from "@/integrations/supabase/client";

export type QaCategory = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  sort_order: number;
  archived: boolean;
};

export type QaPost = {
  id: string;
  organization_id: string;
  author_id: string;
  category_id: string | null;
  title: string;
  body: string;
  tags: string[];
  status: "open" | "resolved" | "closed";
  is_urgent: boolean;
  is_anonymous: boolean;
  allow_private_replies: boolean;
  is_pinned: boolean;
  reply_count: number;
  best_answer_id: string | null;
  last_activity_at: string;
  created_at: string;
};

export type QaReply = {
  id: string;
  post_id: string;
  organization_id: string;
  author_id: string;
  parent_reply_id: string | null;
  body: string;
  is_private: boolean;
  helpful_count: number;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type QaAttachment = {
  id: string;
  resource_id: string;
  organization_id: string;
};

export type FeedTab = "recent" | "trending" | "unanswered" | "mine" | "following";

export const FEED_LABELS: Record<FeedTab, string> = {
  recent: "Recent",
  trending: "Trending",
  unanswered: "Unanswered",
  mine: "My practice areas",
  following: "Following",
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export async function fetchProfilesByIds(ids: string[]) {
  if (ids.length === 0) return {} as Record<string, { full_name: string | null; avatar_url: string | null }>;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url")
    .in("user_id", ids);
  const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  (data ?? []).forEach((p: any) => {
    map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
  });
  return map;
}
