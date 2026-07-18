"use server";

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

type N8nWorkflowPayload = Record<string, unknown>;

export async function triggerN8nWorkflow(workflowId: string, payload: N8nWorkflowPayload) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;

  if (!secret || !baseUrl) {
    console.warn("N8N not configured — skipping workflow trigger");
    return;
  }

  const idempotencyKey = crypto.randomUUID();
  const body = JSON.stringify({ ...payload, idempotencyKey });

  const signature = createHmac("sha256", secret).update(body).digest("hex");

  const response = await fetch(`${baseUrl}/webhook/${workflowId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-n8n-signature": signature,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
  }

  await db.workflowEvent.create({
    data: {
      workflowType: workflowId,
      status: "PROCESSING",
      idempotencyKey,
      payload: { ...payload, workflowId },
    },
  });

  return { idempotencyKey };
}
