const fallbackSupportEmail = "support@docrenewal.pro";
const configuredSupportEmail = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "").trim();

export const SUPPORT_EMAIL = configuredSupportEmail || fallbackSupportEmail;
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const LEGAL_LAST_UPDATED = "April 1, 2026";
