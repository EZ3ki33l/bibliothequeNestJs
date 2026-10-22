-- AlterTable
ALTER TABLE "LearningPath" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "LearningPath_parentId_position_idx" ON "LearningPath"("parentId", "position");

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LearningPath"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
