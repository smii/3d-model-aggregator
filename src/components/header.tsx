import { Boxes } from "lucide-react";
import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { UserMenu } from "@/components/user-menu";
import { HIDE_GMAIL_FEATURES } from "@/lib/config";

export async function Header() {
  const session = HIDE_GMAIL_FEATURES ? null : await auth();

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Boxes className="size-6 text-indigo-400" />
        <span className="text-sm font-semibold tracking-tight">
          3D Model Aggregator
        </span>
      </div>
      {!HIDE_GMAIL_FEATURES &&
        (session?.user ? <UserMenu user={session.user} /> : <SignInButton />)}
    </header>
  );
}
