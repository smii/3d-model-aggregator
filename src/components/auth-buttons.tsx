import { signIn } from "@/auth";
import { signOutAction } from "@/lib/auth-actions";
import { LogIn, LogOut } from "lucide-react";

export function SignInButton({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button
        type="submit"
        className={
          className ??
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        }
      >
        <LogIn className="size-4" />
        Sign in with Google
      </button>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={
          className ??
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        }
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </form>
  );
}
