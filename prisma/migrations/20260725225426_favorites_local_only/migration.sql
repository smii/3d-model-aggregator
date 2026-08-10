/*
  Warnings:

  - You are about to drop the column `userId` on the `FavoriteModel` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FavoriteModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "sourcePlatform" TEXT NOT NULL,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "license" TEXT,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FavoriteModel" ("author", "category", "createdAt", "externalId", "externalUrl", "id", "license", "likesCount", "sourcePlatform", "thumbnailUrl", "title", "updatedAt") SELECT "author", "category", "createdAt", "externalId", "externalUrl", "id", "license", "likesCount", "sourcePlatform", "thumbnailUrl", "title", "updatedAt" FROM "FavoriteModel";
DROP TABLE "FavoriteModel";
ALTER TABLE "new_FavoriteModel" RENAME TO "FavoriteModel";
CREATE INDEX "FavoriteModel_category_idx" ON "FavoriteModel"("category");
CREATE UNIQUE INDEX "FavoriteModel_sourcePlatform_externalId_key" ON "FavoriteModel"("sourcePlatform", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
