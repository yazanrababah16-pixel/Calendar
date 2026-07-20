import { queryOptions } from "@tanstack/react-query";

async function fetchPatients(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`/api/patients${params}`);
  if (!res.ok) throw new Error("Failed to fetch patients");
  return res.json() as Promise<
    Array<{
      id: string;
      dateOfBirth: string | null;
      phone: string | null;
      notes: string | null;
      user: {
        id: string;
        name: string;
        email: string;
        username: string | null;
        image: string | null;
      };
    }>
  >;
}

export function patientsQuery(search?: string) {
  return queryOptions({
    queryKey: ["patients", search],
    queryFn: () => fetchPatients(search),
  });
}

export function patientQuery(id: string) {
  return queryOptions({
    queryKey: ["patients", id],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${id}`);
      if (!res.ok) throw new Error("Failed to fetch patient");
      return res.json() as Promise<{
        id: string;
        dateOfBirth: string | null;
        phone: string | null;
        notes: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          username: string | null;
          image: string | null;
        };
        appointments: Array<{
          id: string;
          startTime: string;
          endTime: string;
          status: string;
          provider: { user: { name: string } };
        }>;
      }>;
    },
  });
}
