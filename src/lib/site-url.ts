const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";

function toAbsoluteUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return DEFAULT_LOCAL_SITE_URL;
  }

  return /^https?:\/\//i.test(normalized) ? normalized.replace(/\/$/, "") : `https://${normalized}`.replace(/\/$/, "");
}

function resolveSiteUrl(): string {
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (explicitUrl) {
    return toAbsoluteUrl(explicitUrl);
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}

export const SITE_URL = resolveSiteUrl();
