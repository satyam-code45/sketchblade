-- AlterTable
ALTER TABLE "Chat" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'user',
                   ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   ALTER COLUMN "userId" DROP NOT NULL;
