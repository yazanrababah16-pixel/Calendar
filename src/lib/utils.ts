import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the absolute base URL for the application.
 * Priority: NEXT_PUBLIC_APP_URL → VERCEL_URL (auto-set by Vercel) → localhost fallback.
 * Use this anywhere you need an absolute URL (cron jobs, webhook callbacks, email links, etc.)
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
