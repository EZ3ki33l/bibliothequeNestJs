-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathModule" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathStep" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_slug_key" ON "LearningPath"("slug");

-- CreateIndex
CREATE INDEX "LearningPath_published_position_idx" ON "LearningPath"("published", "position");

-- CreateIndex
CREATE INDEX "PathModule_pathId_position_idx" ON "PathModule"("pathId", "position");

-- CreateIndex
CREATE INDEX "PathStep_moduleId_position_idx" ON "PathStep"("moduleId", "position");

-- CreateIndex
CREATE INDEX "PathStep_entryId_idx" ON "PathStep"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "PathStep_pathId_entryId_key" ON "PathStep"("pathId", "entryId");

-- AddForeignKey
ALTER TABLE "PathModule" ADD CONSTRAINT "PathModule_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathStep" ADD CONSTRAINT "PathStep_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathStep" ADD CONSTRAINT "PathStep_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "PathModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathStep" ADD CONSTRAINT "PathStep_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
