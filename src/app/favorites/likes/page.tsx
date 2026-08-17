import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SignInButton } from "@/components/auth-buttons";
import { LikedModelsBrowser } from "@/components/LikedModelsBrowser";
import type { LikedModelItem } from "@/components/LikedModelsBrowser";
import { HIDE_GMAIL_FEATURES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Likes | 3D Model Aggregator",
};

export const dynamic = "force-dynamic";

export default async function LikesPage() {
  if (HIDE_GMAIL_FEATURES) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">
          Imported likes are disabled on this instance.
        </div>
      </div>
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading />
        <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-sm text-zinc-400">
            Sign in with Google to see the likes and collections imported from
            your linked accounts.
          </p>
          <SignInButton className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500" />
        </div>
      </div>
    );
  }

  const savedModels = await prisma.savedModel.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const items: LikedModelItem[] = savedModels.map((model) => ({
    id: model.id,
    title: model.title,
    externalUrl: model.externalUrl,
    thumbnailUrl: model.thumbnailUrl,
    sourcePlatform: model.sourcePlatform,
    originalLikesCount: model.originalLikesCount,
    collectionName: model.collectionName,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeading />
      <LikedModelsBrowser items={items} />
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Likes</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Everything you&apos;ve liked and synced from your linked platforms, in
        one place.
      </p>
    </div>
  );
}
