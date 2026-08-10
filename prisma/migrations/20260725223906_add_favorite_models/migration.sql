-- CreateTable
CREATE TABLE "FavoriteModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FavoriteModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FavoriteModel_userId_category_idx" ON "FavoriteModel"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteModel_userId_sourcePlatform_externalId_key" ON "FavoriteModel"("userId", "sourcePlatform", "externalId");
