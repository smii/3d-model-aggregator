"use client";

import { ModelCard } from "@/components/ModelCard";
import type { UnifiedModelResult } from "@/types/model";

interface ModelGridProps {
  models: ReadonlyArray<UnifiedModelResult>;
  onToggleSave: (model: UnifiedModelResult) => void;
}

export function ModelGrid({ models, onToggleSave }: ModelGridProps) {
  return (
    <div className="grid flex-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {models.map((model) => (
        <ModelCard
          key={`${model.sourcePlatform}:${model.id}`}
          model={model}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}
