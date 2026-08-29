-- CreateTable
CREATE TABLE "AICredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "fingerprint" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "lastValidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPreference" (
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "credentialId" TEXT,
    "modelDiagram" TEXT,
    "modelEvaluate" TEXT,
    "modelEdit" TEXT,
    "modelChat" TEXT,

    CONSTRAINT "AIPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AICredential_userId_fingerprint_key" ON "AICredential"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "AICredential_userId_provider_idx" ON "AICredential"("userId", "provider");

-- AddForeignKey
ALTER TABLE "AICredential" ADD CONSTRAINT "AICredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPreference" ADD CONSTRAINT "AIPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
