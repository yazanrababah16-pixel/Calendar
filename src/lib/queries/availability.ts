import { queryOptions } from "@tanstack/react-query";

export interface AvailabilityFilters {
  providerId?: string;
  dayOfWeek?: number;
}

async function fetchAvailability(filters?: AvailabilityFilters) {
  const params = new URLSearchParams();
  if (filters?.providerId) params.set("providerId", filters.providerId);
  if (filters?.dayOfWeek !== undefined) params.set("dayOfWeek", String(filters.dayOfWeek));

  const qs = params.toString();
  const res = await fetch(`/api/availability${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch availability");
  return res.json() as Promise<
    Array<{
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive: boolean;
      providerId: string;
      provider: { user: { name: string } };
    }>
  >;
}

export function availabilityQuery(filters?: AvailabilityFilters) {
  return queryOptions({
    queryKey: ["availability", filters],
    queryFn: () => fetchAvailability(filters),
  });
}
