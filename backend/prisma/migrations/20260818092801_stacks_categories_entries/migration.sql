-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('FUNCTION', 'COMPONENT', 'CONCEPT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ReviewRating" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');

-- CreateTable
CREATE TABLE "Stack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "bodyMdx" TEXT NOT NULL DEFAULT '',
    "kind" "EntryKind" NOT NULL,
    "diffulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "template" TEXT NOT NULL DEFAULT 'react-ts',
    "files" JSONB NOT NULL,
    "dependencies" JSONB,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "rating" "ReviewRating" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttemp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryID" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttemp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stack_slug_key" ON "Stack"("slug");

-- CreateIndex
CREATE INDEX "Category_stackId_idx" ON "Category"("stackId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_stackId_slug_key" ON "Category"("stackId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_slug_key" ON "Entry"("slug");

-- CreateIndex
CREATE INDEX "Entry_categoryId_idx" ON "Entry"("categoryId");

-- CreateIndex
CREATE INDEX "Entry_published_kind_idx" ON "Entry"("published", "kind");

-- CreateIndex
CREATE INDEX "ReviewCard_userId_nextReviewAt_idx" ON "ReviewCard"("userId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCard_userId_entryId_key" ON "ReviewCard"("userId", "entryId");

-- CreateIndex
CREATE INDEX "ReviewLog_cardId_idx" ON "ReviewLog"("cardId");

-- CreateIndex
CREATE INDEX "QuizAttemp_userId_entryID_idx" ON "QuizAttemp"("userId", "entryID");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "Stack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCard" ADD CONSTRAINT "ReviewCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCard" ADD CONSTRAINT "ReviewCard_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "ReviewCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemp" ADD CONSTRAINT "QuizAttemp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemp" ADD CONSTRAINT "QuizAttemp_entryID_fkey" FOREIGN KEY ("entryID") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
