import type { Metadata } from "next";
import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { SyncPlatforms } from "@/components/sync-platforms";

export const metadata: Metadata = {
  title: "Account Sync | 3D Model Aggregator",
};

const searchOnlyPlatforms = [
  {
    name: "Cults3D",
    description: "Import your liked creations from Cults3D.",
  },
  {
    name: "Thangs",
    description: "Import your liked models from Thangs.",
  },
];

export default async function SyncPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account Sync</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Link your accounts on external platforms to import your likes and
          collections. Imports run in the background and appear under
          Favorites.
        </p>
      </div>

      {session?.user ? (
        <SyncPlatforms />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-sm text-zinc-400">
            Sign in with Google to connect your Thingiverse, Printables, and
            MakerWorld accounts.
          </p>
          <SignInButton className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500" />
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-zinc-500">Search only</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {searchOnlyPlatforms.map(({ name, description }) => (
            <div
              key={name}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 opacity-70"
            >
              <h3 className="font-medium">{name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{description}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Account connection coming soon
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
