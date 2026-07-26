interface AppointmentReminderData {
  patientName: string;
  patientPhone: string;
  providerName: string;
  startTime: string;
  appointmentId: string;
}

export function formatAppointmentReminder(data: AppointmentReminderData): string {
  const startDate = new Date(data.startTime);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = startDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `Hello ${data.patientName}, this is a reminder that you have an appointment tomorrow at ${timeStr} with Dr. ${data.providerName} (${dateStr}). Please reply CONFIRM to confirm or call us if you need to reschedule.`;
}
