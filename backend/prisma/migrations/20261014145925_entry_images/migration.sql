-- CreateTable
CREATE TABLE "EntryImage" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "alt" VARCHAR(250) NOT NULL,
    "caption" VARCHAR(300) NOT NULL DEFAULT '',
    "readingKey" TEXT NOT NULL,
    "fullKey" TEXT NOT NULL,
    "readingWidth" INTEGER NOT NULL,
    "readingHeight" INTEGER NOT NULL,
    "readingBytes" INTEGER NOT NULL,
    "fullWidth" INTEGER NOT NULL,
    "fullHeight" INTEGER NOT NULL,
    "fullBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntryImage_readingKey_key" ON "EntryImage"("readingKey");

-- CreateIndex
CREATE UNIQUE INDEX "EntryImage_fullKey_key" ON "EntryImage"("fullKey");

-- CreateIndex
CREATE INDEX "EntryImage_entryId_createdAt_idx" ON "EntryImage"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "EntryImage_uploadedById_createdAt_idx" ON "EntryImage"("uploadedById", "createdAt");

-- AddForeignKey
ALTER TABLE "EntryImage" ADD CONSTRAINT "EntryImage_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryImage" ADD CONSTRAINT "EntryImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

