import { publicEnv } from "@/lib/env/public";

export const SITE_URL = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
