import { queryOptions } from "@tanstack/react-query";

export interface ProviderFilters {
  isActive?: boolean;
  specialty?: string;
}

async function fetchProviders(filters?: ProviderFilters) {
  const params = new URLSearchParams();
  if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
  if (filters?.specialty) params.set("specialty", filters.specialty);

  const qs = params.toString();
  const res = await fetch(`/api/providers${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch providers");
  return res.json() as Promise<
    Array<{
      id: string;
      specialty: string | null;
      phone: string | null;
      bio: string | null;
      isActive: boolean;
      user: { id: string; name: string; email: string; image: string | null };
    }>
  >;
}

export function providersQuery(filters?: ProviderFilters) {
  return queryOptions({
    queryKey: ["providers", filters],
    queryFn: () => fetchProviders(filters),
  });
}

export function providerQuery(id: string) {
  return queryOptions({
    queryKey: ["providers", id],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${id}`);
      if (!res.ok) throw new Error("Failed to fetch provider");
      return res.json() as Promise<{
        id: string;
        specialty: string | null;
        phone: string | null;
        bio: string | null;
        isActive: boolean;
        user: { id: string; name: string; email: string; image: string | null };
        availabilities: Array<{
          id: string;
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          isActive: boolean;
        }>;
      }>;
    },
  });
}
