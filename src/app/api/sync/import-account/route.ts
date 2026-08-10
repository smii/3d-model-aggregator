import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { runImportJob } from "@/lib/sync/import-runner";
import {
  isSyncPlatform,
  PLATFORM_COOKIE_DOMAINS,
  SYNC_PLATFORMS,
  type SyncPlatform,
} from "@/lib/sync/platforms";
import {
  unusableAuthReason,
  type AccountCredentials,
  type AccountSyncAuth,
  type SessionCookie,
} from "@/lib/scrapers/account-sync";

// Playwright needs the full Node.js runtime.
export const runtime = "nodejs";

interface ImportAccountBody {
  platform: SyncPlatform;
  /**
   * Session cookies for the platform account, either as an array of
   * { name, value, domain?, path? } objects or as a raw Cookie header string
   * ("session=abc; csrftoken=def") pasted from the browser's dev tools.
   */
  cookies?: SessionCookie[] | string;
  /**
   * Username/email + password login. Fallback for platforms whose scraper can
   * drive the login form (currently MakerWorld); cookies are always preferred
   * since form logins can hit CAPTCHA or 2FA.
   */
  credentials?: AccountCredentials;
  /** Public profile username; enables the Thingiverse REST API path. */
  username?: string;
}

/** Returns the parsed cookies, or a string describing why input is invalid. */
function parseCookies(
  input: unknown,
  platform: SyncPlatform
): SessionCookie[] | string {
  const domain = PLATFORM_COOKIE_DOMAINS[platform];

  if (typeof input === "string") {
    const cookies = input
      .split(";")
      .map((pair) => {
        const eq = pair.indexOf("=");
        if (eq === -1) return null;
        return {
          name: pair.slice(0, eq).trim(),
          value: pair.slice(eq + 1).trim(),
          domain,
          path: "/",
        };
      })
      .filter((cookie): cookie is SessionCookie => cookie !== null);
    return cookies.length > 0
      ? cookies
      : "cookies string contains no name=value pairs";
  }

  if (Array.isArray(input)) {
    if (input.length === 0) return "cookies array is empty";
    const cookies: SessionCookie[] = [];
    for (const entry of input) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as SessionCookie).name !== "string" ||
        typeof (entry as SessionCookie).value !== "string"
      ) {
        return "each cookie must be an object with string name and value";
      }
      const cookie = entry as Partial<SessionCookie> & {
        name: string;
        value: string;
      };
      cookies.push({
        name: cookie.name,
        value: cookie.value,
        domain: typeof cookie.domain === "string" ? cookie.domain : domain,
        path: typeof cookie.path === "string" ? cookie.path : "/",
      });
    }
    return cookies;
  }

  return "cookies must be an array of { name, value } objects or a raw Cookie header string";
}

/** Returns the parsed credentials, or a string describing why input is invalid. */
function parseCredentials(input: unknown): AccountCredentials | string {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof (input as AccountCredentials).identifier !== "string" ||
    typeof (input as AccountCredentials).password !== "string"
  ) {
    return "credentials must be an object with string identifier and password";
  }
  const identifier = (input as AccountCredentials).identifier.trim();
  const password = (input as AccountCredentials).password;
  if (!identifier || !password) {
    return "credentials identifier and password must be non-empty";
  }
  return { identifier, password };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: Partial<ImportAccountBody>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isSyncPlatform(body.platform)) {
    return NextResponse.json(
      {
        error: `Unsupported platform. Expected one of: ${SYNC_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const platform = body.platform;

  const importAuth: AccountSyncAuth = {};

  if (body.cookies != null) {
    const cookies = parseCookies(body.cookies, platform);
    if (typeof cookies === "string") {
      return NextResponse.json({ error: cookies }, { status: 400 });
    }
    importAuth.cookies = cookies;
  }

  if (body.credentials != null) {
    const credentials = parseCredentials(body.credentials);
    if (typeof credentials === "string") {
      return NextResponse.json({ error: credentials }, { status: 400 });
    }
    importAuth.credentials = credentials;
  }

  if (body.username != null) {
    if (typeof body.username !== "string" || !body.username.trim()) {
      return NextResponse.json(
        { error: "username must be a non-empty string" },
        { status: 400 }
      );
    }
    importAuth.username = body.username.trim();
  }

  const authProblem = unusableAuthReason(importAuth, platform);
  if (authProblem) {
    return NextResponse.json({ error: authProblem }, { status: 400 });
  }

  // Refuse to queue a second concurrent import for the same platform; the
  // running job would race it on PlatformAccount cookies and SavedModel rows.
  const activeJob = await prisma.syncJob.findFirst({
    where: {
      userId,
      platformName: platform,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (activeJob) {
    return NextResponse.json(
      { error: "An import for this platform is already in progress", jobId: activeJob.id },
      { status: 409 }
    );
  }

  const encryptedCookies = encryptSecret(JSON.stringify(importAuth));
  const [, job] = await prisma.$transaction([
    prisma.platformAccount.upsert({
      where: { userId_platformName: { userId, platformName: platform } },
      create: { userId, platformName: platform, encryptedCookies },
      update: { encryptedCookies },
    }),
    prisma.syncJob.create({
      data: { userId, platformName: platform, status: "PENDING" },
    }),
  ]);

  // Run the Playwright scrape after the response is sent so the HTTP request
  // never waits on (or times out because of) browser work.
  after(() => runImportJob(job.id));

  return NextResponse.json(
    { jobId: job.id, platform, status: job.status },
    { status: 202 }
  );
}
