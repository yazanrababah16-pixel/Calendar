export const EMERGENCY_CANCELLATION_MESSAGE = (providerName: string): string =>
  `Doctor ${providerName} has an unforeseen emergency. Your appointment has been temporarily paused, and the clinic will propose a new time for you shortly.`;

export const EMERGENCY_CANCELLATION_STAFF_MESSAGE = (providerName: string, date: string): string =>
  `Emergency: Dr. ${providerName}'s schedule for ${date} has been cancelled. All affected appointments flagged for rescheduling.`;
