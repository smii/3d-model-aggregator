-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "platforms" TEXT NOT NULL,
    "category" TEXT,
    "sort" TEXT NOT NULL DEFAULT 'newest',
    "lastSeenIds" TEXT NOT NULL DEFAULT '',
    "newResultsCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
