-- CreateTable
CREATE TABLE "registration_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "whatsappChatId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ,
    "reviewedBy" TEXT,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_requests_whatsappChatId_idx" ON "registration_requests"("whatsappChatId");

-- CreateIndex
CREATE INDEX "registration_requests_phone_idx" ON "registration_requests"("phone");

-- CreateIndex
CREATE INDEX "registration_requests_status_idx" ON "registration_requests"("status");
