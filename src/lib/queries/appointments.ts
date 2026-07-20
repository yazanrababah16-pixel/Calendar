import { queryOptions } from "@tanstack/react-query";

export interface AppointmentFilters {
  providerId?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export type WorkflowEventInfo = {
  id: string;
  workflowType: string;
  status: string;
  createdAt: string;
};

export type AppointmentListItem = {
  id: string;
  title: string | null;
  notes: string | null;
  color: string | null;
  status: string;
  startTime: string;
  endTime: string;
  patientId: string;
  providerId: string;
  patient: { user: { name: string; email: string } };
  provider: { user: { name: string; email: string } };
  workflowEvents?: WorkflowEventInfo[];
};

export type AppointmentDetail = AppointmentListItem & {
  workflowEvents: WorkflowEventInfo[];
};

async function fetchAppointments(filters?: AppointmentFilters) {
  const params = new URLSearchParams();
  if (filters?.providerId) params.set("providerId", filters.providerId);
  if (filters?.patientId) params.set("patientId", filters.patientId);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (filters?.status) params.set("status", filters.status);

  const qs = params.toString();
  const res = await fetch(`/api/appointments${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch appointments");
  return res.json() as Promise<AppointmentListItem[]>;
}

export function appointmentsQuery(filters?: AppointmentFilters) {
  return queryOptions({
    queryKey: ["appointments", filters],
    queryFn: () => fetchAppointments(filters),
  });
}

export function appointmentQuery(id: string) {
  return queryOptions({
    queryKey: ["appointments", id],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${id}`);
      if (!res.ok) throw new Error("Failed to fetch appointment");
      return res.json() as Promise<AppointmentDetail>;
    },
  });
}
