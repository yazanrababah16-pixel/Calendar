#!/usr/bin/env node

/**
 * Mock WhatsApp Booking Request — Test Script
 *
 * Sends a fake booking request directly to the Next.js API,
 * bypassing n8n entirely. Tests the full database flow.
 *
 * Usage:
 *   node scripts/test-booking.js
 *   node scripts/test-booking.js --phone +970599123456 --date 2026-07-28 --time 10:00
 *   node scripts/test-booking.js --approve <booking-request-id>
 *   node scripts/test-booking.js --reject <booking-request-id> --reason "Fully booked"
 *   node scripts/test-booking.js --modify <booking-request-id> --new-start 2026-07-29T14:00:00 --new-end 2026-07-29T14:30:00
 */

const BASE_URL = process.env.NEXTJS_URL || "http://localhost:3000";

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace(/^--/, "");
      const next = args[i + 1];
      flags[key] = next && !next.startsWith("--") ? next : true;
      if (next && !next.startsWith("--")) i++;
    }
  }
  return flags;
}

async function sendBookingRequest(flags) {
  const payload = {
    workflowType: "booking_request",
    idempotencyKey: flags.idempotency || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientPhone: flags.phone || "+970599123456",
    patientName: flags.name || "Test Patient",
    requestedDate: flags.date || "2026-07-28",
    requestedTime: flags.time || "09:00",
    durationMinutes: parseInt(flags.duration || "30", 10),
    message: flags.message || "I'd like to book an appointment on Monday at 9am for a skin consultation",
  };

  console.log("\n--- Sending Booking Request ---");
  console.log("Payload:", JSON.stringify(payload, null, 2));

  const res = await fetch(`${BASE_URL}/api/webhooks/n8n/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`\nResponse [${res.status}]:`, JSON.stringify(data, null, 2));
  return data;
}

async function approveRequest(id) {
  console.log(`\n--- Approving Booking Request: ${id} ---`);

  const res = await fetch(`${BASE_URL}/api/test/approve-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

  const data = await res.json();
  console.log(`Response [${res.status}]:`, JSON.stringify(data, null, 2));
  return data;
}

async function rejectRequest(id, reason) {
  console.log(`\n--- Rejecting Booking Request: ${id} ---`);

  const res = await fetch(`${BASE_URL}/api/test/reject-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reason: reason || "Test rejection" }),
  });

  const data = await res.json();
  console.log(`Response [${res.status}]:`, JSON.stringify(data, null, 2));
  return data;
}

async function listRequests() {
  console.log("\n--- Listing Pending Booking Requests ---");

  const res = await fetch(`${BASE_URL}/api/test/list-bookings`);
  const data = await res.json();
  console.log(`Response [${res.status}]:`, JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  const flags = parseArgs();

  if (flags.approve) {
    await approveRequest(flags.approve);
  } else if (flags.reject) {
    await rejectRequest(flags.reject, flags.reason);
  } else if (flags.list) {
    await listRequests();
  } else {
    await sendBookingRequest(flags);
  }
}

main().catch(console.error);
