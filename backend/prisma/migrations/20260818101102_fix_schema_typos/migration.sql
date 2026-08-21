/*
  Warnings:

  - You are about to drop the column `createAt` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `diffulty` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the `QuizAttemp` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "QuizAttemp" DROP CONSTRAINT "QuizAttemp_entryID_fkey";

-- DropForeignKey
ALTER TABLE "QuizAttemp" DROP CONSTRAINT "QuizAttemp_userId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "createAt",
DROP COLUMN "diffulty",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER';

-- DropTable
DROP TABLE "QuizAttemp";

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_entryId_idx" ON "QuizAttempt"("userId", "entryId");

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
