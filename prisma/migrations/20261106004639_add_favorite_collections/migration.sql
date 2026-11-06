-- CreateTable
CREATE TABLE "FavoriteCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FavoriteCollectionItem" (
    "collectionId" TEXT NOT NULL,
    "favoriteId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("collectionId", "favoriteId"),
    CONSTRAINT "FavoriteCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FavoriteCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FavoriteCollectionItem_favoriteId_fkey" FOREIGN KEY ("favoriteId") REFERENCES "FavoriteModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteCollection_name_key" ON "FavoriteCollection"("name");

-- CreateIndex
CREATE INDEX "FavoriteCollectionItem_favoriteId_idx" ON "FavoriteCollectionItem"("favoriteId");
