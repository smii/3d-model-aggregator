import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Local dev runs on SQLite. For production PostgreSQL, switch the datasource
// provider in prisma/schema.prisma and replace the adapter with:
//   import { PrismaPg } from "@prisma/adapter-pg";
//   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Reuse a single client across Next.js dev-server hot reloads
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const SYNC_JOB_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;

// SQLite has no enums, so SyncJob.status is a plain String column; use this
// type at the application boundary to keep values consistent.
export type SyncJobStatus = (typeof SYNC_JOB_STATUSES)[number];
