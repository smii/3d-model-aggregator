import type { Metadata } from "next";
import { UserCircle, Shield, Trash2 } from "lucide-react";
import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";

export const metadata: Metadata = {
  title: "Settings | 3D Model Aggregator",
};

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your account and data.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <UserCircle className="size-5 text-zinc-400" />
          Account
        </h2>
        {session?.user ? (
          <>
            <p className="mt-2 text-sm text-zinc-400">
              Signed in as {session.user.name} ({session.user.email}).
            </p>
            <div className="mt-4">
              <SignOutButton className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 flex items-center gap-2" />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-400">
              Sign in with Google to save favorites and link external platform
              accounts.
            </p>
            <div className="mt-4">
              <SignInButton className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 flex items-center gap-2" />
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Shield className="size-5 text-zinc-400" />
          Privacy & sessions
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Platform session tokens are stored encrypted and only used to sync
          your likes and collections. You can disconnect a platform at any time
          on the Account Sync page.
        </p>
      </section>

      <section className="rounded-xl border border-red-900/40 bg-red-950/20 p-5">
        <h2 className="flex items-center gap-2 font-medium text-red-300">
          <Trash2 className="size-5" />
          Danger zone
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Delete your account and all imported data. This cannot be undone.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-red-900/60 px-3.5 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-950/40"
        >
          Delete account
        </button>
      </section>
    </div>
  );
}
