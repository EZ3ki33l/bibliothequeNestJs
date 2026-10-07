-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "verifiedOn" DATE,
ADD COLUMN     "verifiedVersion" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "EntrySource" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT NOT NULL DEFAULT '',
    "consultedOn" DATE,
    "licenseName" TEXT NOT NULL DEFAULT '',
    "licenseUrl" TEXT NOT NULL DEFAULT '',
    "adapted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EntrySource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntrySource_entryId_idx" ON "EntrySource"("entryId");

-- AddForeignKey
ALTER TABLE "EntrySource" ADD CONSTRAINT "EntrySource_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
