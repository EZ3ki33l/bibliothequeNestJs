CREATE TABLE "EntryRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryRead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EntryRead_userId_lastReadAt_idx" ON "EntryRead"("userId", "lastReadAt");
CREATE UNIQUE INDEX "EntryRead_userId_entryId_key" ON "EntryRead"("userId", "entryId");
ALTER TABLE "EntryRead" ADD CONSTRAINT "EntryRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryRead" ADD CONSTRAINT "EntryRead_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise AVANT suppression : une carte prouve que la fiche a été ouverte.
INSERT INTO "EntryRead" ("id", "userId", "entryId", "createdAt", "lastReadAt")
SELECT gen_random_uuid(), "userId", "entryId", "createdAt", COALESCE("lastReviewedAt", "createdAt")
FROM "ReviewCard";

ALTER TABLE "ReviewCard" DROP CONSTRAINT "ReviewCard_entryId_fkey";
ALTER TABLE "ReviewCard" DROP CONSTRAINT "ReviewCard_userId_fkey";
ALTER TABLE "ReviewLog" DROP CONSTRAINT "ReviewLog_cardId_fkey";
DROP TABLE "ReviewLog";
DROP TABLE "ReviewCard";
DROP TYPE "ReviewRating";
