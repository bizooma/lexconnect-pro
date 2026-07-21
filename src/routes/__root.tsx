import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { VideoAskWidget } from "@/components/videoask-widget";
import { PortalThemeProvider, usePortalTheme } from "@/components/portal-theme-provider";

function NotFoundComponent() {
  const { portal, displayName } = usePortalTheme();
  const brandName = displayName ?? "LexGuild";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {portal?.logo_url && (
          <img
            src={portal.logo_url}
            alt={`${brandName} logo`}
            className="mx-auto mb-4 h-14 w-14 rounded-lg border border-border bg-background object-contain p-1"
          />
        )}
        <p className="text-sm font-medium text-gold">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist{portal ? ` on ${brandName}` : ""}.
        </p>
        <Link
          to={portal ? "/app/dashboard" : "/"}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {portal ? "Back to dashboard" : "Back to home"}
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { portal, displayName } = usePortalTheme();
  const brandName = displayName ?? "LexGuild";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {portal?.logo_url && (
          <img
            src={portal.logo_url}
            alt={`${brandName} logo`}
            className="mx-auto mb-4 h-14 w-14 rounded-lg border border-border bg-background object-contain p-1"
          />
        )}
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1c2540" },
      { title: "LexGuild — Modern attorney mentorship" },
      { name: "description", content: "A modern, mobile-first mentorship platform for attorneys, bar associations, and legal organizations." },
      { property: "og:title", content: "LexGuild — Modern attorney mentorship" },
      { property: "og:description", content: "A modern, mobile-first mentorship platform for attorneys, bar associations, and legal organizations." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://lexguild.com" },
      { property: "og:image", content: "https://lexguild.com/og-image.png" },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { property: "og:image:alt", content: "LexGuild — Modern Mentorship for the Legal Profession" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "LexGuild — Modern attorney mentorship" },
      { name: "twitter:description", content: "A modern, mobile-first mentorship platform for attorneys, bar associations, and legal organizations." },
      { name: "twitter:image", content: "https://lexguild.com/og-image.png" },
      { name: "twitter:image:alt", content: "LexGuild — Modern Mentorship for the Legal Profession" },
      { name: "twitter:site", content: "@lexguild" },
      { name: "keywords", content: "attorney mentorship, legal mentorship platform, bar association software, law firm mentoring, lawyer mentor matching, legal professional development, mentorship app for attorneys, bar association mentorship program" },
      { name: "author", content: "LexGuild" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "format-detection", content: "telephone=no" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "LexGuild" },
      { name: "application-name", content: "LexGuild" },
    ],
    links: [
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icons/favicon-16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      // iOS startup splash screens (portrait). Each must match an exact device size.
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-14-pro-max.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-14-pro.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-14-plus.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-14.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-x.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-11-pro-max.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-11.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-8-plus.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-8.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-iphone-se.png", media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-ipad-pro-12.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-ipad-pro-11.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-ipad-air.png", media: "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-ipad-10.png", media: "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-ipad-mini.png", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
    scripts: [
      {
        src: "https://datarightsos.com/functions/widgetJs",
        defer: true,
        "data-tessera-site": "sk_u8hbbxe6j9d83q3ajur13cil",
      },
      {
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=G-T5YBQFESKV",
      },
      {
        children: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-T5YBQFESKV');`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://lexguild.com/#organization",
              name: "LexGuild",
              url: "https://lexguild.com/",
              logo: "https://lexguild.com/icons/icon-512.png",
              description: "Modern, mobile-first mentorship platform for attorneys, bar associations, and legal organizations.",
              sameAs: ["https://lexguild.com/"],
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "sales",
                  email: "joe@bizooma.com",
                  areaServed: "US",
                  availableLanguage: ["English"],
                },
              ],
            },
            {
              "@type": "WebSite",
              "@id": "https://lexguild.com/#website",
              url: "https://lexguild.com/",
              name: "LexGuild",
              publisher: { "@id": "https://lexguild.com/#organization" },
              inLanguage: "en-US",
            },
            {
              "@type": "SoftwareApplication",
              name: "LexGuild",
              operatingSystem: "Web, iOS, Android",
              applicationCategory: "BusinessApplication",
              description: "Mentorship and member engagement platform for bar associations, law firms, and legal organizations.",
              offers: [
                { "@type": "Offer", name: "Starter", price: "399", priceCurrency: "USD", category: "subscription" },
                { "@type": "Offer", name: "Professional", price: "899", priceCurrency: "USD", category: "subscription" },
                { "@type": "Offer", name: "Enterprise", price: "1500", priceCurrency: "USD", category: "subscription" },
              ],
            },
            {
              "@type": "WebPage",
              "@id": "https://lexguild.com/#webpage",
              url: "https://lexguild.com/",
              name: "LexGuild — Modern attorney mentorship",
              isPartOf: { "@id": "https://lexguild.com/#website" },
              about: { "@id": "https://lexguild.com/#organization" },
              speakable: {
                "@type": "SpeakableSpecification",
                cssSelector: ["h1", "h2", "[data-speakable]"],
              },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PortalThemeProvider>
          <Outlet />
          <PortalAwareVideoAsk />
        </PortalThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function PortalAwareVideoAsk() {
  const { portal, loading } = usePortalTheme();
  if (loading || portal) return null;
  return <VideoAskWidget />;
}

