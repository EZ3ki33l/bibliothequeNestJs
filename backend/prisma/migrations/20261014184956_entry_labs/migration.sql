-- CreateEnum
CREATE TYPE "LabTool" AS ENUM ('VAGRANT', 'DOCKER_COMPOSE', 'CONTAINERLAB', 'GNS3', 'OTHER');

-- CreateEnum
CREATE TYPE "LabHost" AS ENUM ('LINUX', 'WINDOWS', 'MACOS');

-- CreateTable
CREATE TABLE "EntryLab" (
    "entryId" TEXT NOT NULL,
    "tool" "LabTool" NOT NULL,
    "securityLab" BOOLEAN NOT NULL DEFAULT false,
    "software" TEXT NOT NULL DEFAULT '',
    "ramGb" INTEGER NOT NULL,
    "diskGb" INTEGER NOT NULL,
    "hosts" "LabHost"[],
    "setupMd" TEXT NOT NULL DEFAULT '',
    "teardownMd" TEXT NOT NULL DEFAULT '',
    "files" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryLab_pkey" PRIMARY KEY ("entryId")
);

-- AddForeignKey
ALTER TABLE "EntryLab" ADD CONSTRAINT "EntryLab_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
