"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Heart, LogOut, Settings, UserCircle } from "lucide-react";
import { signOutAction } from "@/lib/auth-actions";

type MenuUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const itemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";

export function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <UserCircle className="size-6 text-zinc-400" />
        )}
        <span className="hidden sm:inline">{user.name}</span>
        <ChevronDown
          className={`size-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-lg shadow-black/40"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-zinc-100">
              {user.name}
            </p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          <div className="my-1 border-t border-zinc-800" />
          <Link
            href="/favorites"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <Heart className="size-4" />
            Favorites
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <div className="my-1 border-t border-zinc-800" />
          <form action={signOutAction}>
            <button type="submit" role="menuitem" className={itemClass}>
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
