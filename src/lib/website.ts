// Shared types + helpers for the Website Builder module (client-safe).

export type WebsitePageStatus =
  | "draft"
  | "ready_for_review"
  | "scheduled"
  | "published"
  | "archived";

export type WebsitePageType =
  | "home"
  | "landing"
  | "event"
  | "sponsor"
  | "committee"
  | "mentorship"
  | "cle"
  | "resource"
  | "blog"
  | "legal_aid"
  | "custom";

export type WebsiteSectionType =
  | "hero"
  | "text"
  | "image_text"
  | "cta"
  | "event_details"
  | "sponsor_grid"
  | "speaker_cards"
  | "member_directory"
  | "committee_cards"
  | "resource_cards"
  | "faq"
  | "testimonials"
  | "contact_form"
  | "newsletter"
  | "video"
  | "pricing_tiers"
  | "feature_grid"
  | "stats"
  | "timeline"
  | "custom_html";

export type WebsiteAiKind =
  | "page_draft"
  | "section_rewrite"
  | "copy_rewrite"
  | "seo"
  | "accessibility"
  | "faq"
  | "cta";

export type WebsiteSection = {
  id: string;
  page_id: string;
  organization_id: string;
  section_type: WebsiteSectionType;
  display_order: number;
  settings_json: Record<string, unknown>;
  content_json: Record<string, unknown>;
  visible: boolean;
  responsive_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WebsitePage = {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  page_type: WebsitePageType;
  status: WebsitePageStatus;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  content_json: Record<string, unknown>;
  content_html: string | null;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WebsiteTemplate = {
  id: string;
  organization_id: string | null;
  is_global: boolean;
  name: string;
  description: string | null;
  page_type: WebsitePageType;
  preview_image: string | null;
  default_sections_json: Array<{
    section_type: WebsiteSectionType;
    settings_json?: Record<string, unknown>;
    content_json?: Record<string, unknown>;
  }>;
  suggested_copy_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WebsiteBrandSettings = {
  organization_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  button_style: string | null;
  page_width: string | null;
  border_radius: string | null;
  seo_title_suffix: string | null;
  social_links: Record<string, string>;
  contact_info: Record<string, string>;
  footer_text: string | null;
};

export type WebsiteSavedSection = {
  id: string;
  organization_id: string;
  name: string;
  section_type: WebsiteSectionType;
  settings_json: Record<string, unknown>;
  content_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const PAGE_TYPE_LABELS: Record<WebsitePageType, string> = {
  home: "Home Page",
  landing: "Landing Page",
  event: "Event Page",
  sponsor: "Sponsor Page",
  committee: "Committee Page",
  mentorship: "Mentorship Page",
  cle: "CLE Page",
  resource: "Resource Page",
  blog: "Blog/News Article",
  legal_aid: "Legal Aid Page",
  custom: "Custom Page",
};

export const STATUS_LABELS: Record<WebsitePageStatus, string> = {
  draft: "Draft",
  ready_for_review: "Ready for Review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

export const SECTION_LABELS: Record<WebsiteSectionType, string> = {
  hero: "Hero",
  text: "Text Block",
  image_text: "Image + Text",
  cta: "CTA Banner",
  event_details: "Event Details",
  sponsor_grid: "Sponsor Grid",
  speaker_cards: "Speaker Cards",
  member_directory: "Member Directory",
  committee_cards: "Committee Cards",
  resource_cards: "Resource Cards",
  faq: "FAQ",
  testimonials: "Testimonials",
  contact_form: "Contact Form",
  newsletter: "Newsletter Signup",
  video: "Video Embed",
  pricing_tiers: "Pricing / Tiers",
  feature_grid: "Feature Grid",
  stats: "Stats",
  timeline: "Timeline",
  custom_html: "Custom HTML",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export type SeoIssue = { id: string; level: "warn" | "error" | "info"; message: string };

export function analyzePageSeo(page: Pick<WebsitePage, "title" | "slug" | "meta_title" | "meta_description" | "og_image"> & { sections: WebsiteSection[] }): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  if (!page.meta_title || page.meta_title.length < 20) issues.push({ id: "title", level: "warn", message: "Meta title should be 20–60 characters." });
  if (page.meta_title && page.meta_title.length > 60) issues.push({ id: "title-long", level: "warn", message: "Meta title is over 60 characters." });
  if (!page.meta_description || page.meta_description.length < 50) issues.push({ id: "desc", level: "warn", message: "Meta description should be 50–160 characters." });
  if (page.meta_description && page.meta_description.length > 160) issues.push({ id: "desc-long", level: "warn", message: "Meta description is over 160 characters." });
  if (!page.og_image) issues.push({ id: "og", level: "info", message: "Add an Open Graph image for social sharing." });
  const heroes = page.sections.filter((s) => s.section_type === "hero");
  if (heroes.length === 0) issues.push({ id: "hero", level: "warn", message: "No hero section — add one for a strong heading hierarchy." });
  if (heroes.length > 1) issues.push({ id: "hero-many", level: "warn", message: "Multiple hero sections detected — only one H1 should exist per page." });
  const ctas = page.sections.filter((s) => s.section_type === "cta" || s.section_type === "contact_form");
  if (ctas.length === 0) issues.push({ id: "cta", level: "warn", message: "No call-to-action — add a CTA or contact form." });
  const max = 6;
  const score = Math.max(0, Math.round(100 - (issues.length / max) * 100));
  return { score, issues };
}
