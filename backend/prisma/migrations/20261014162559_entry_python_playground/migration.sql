-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "playgroundExpectedOutput" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "playgroundInput" TEXT NOT NULL DEFAULT '';
