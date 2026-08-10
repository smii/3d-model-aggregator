import type {
  ModelCategory,
  SourcePlatform,
  UnifiedModelResult,
} from '@/types/model';

export interface SearchOptions {
  query: string;
  /** 1-based page index. Defaults to 1. */
  page?: number;
  /** Results requested per platform. Defaults to 20. */
  perPage?: number;
  /** Restrict results to a unified category, where the platform supports it. */
  category?: ModelCategory;
  /** Caller-provided signal, e.g. from an aborted route handler request. */
  signal?: AbortSignal;
}

export interface SearchAdapter {
  platform: SourcePlatform;
  search(options: SearchOptions): Promise<UnifiedModelResult[]>;
  /**
   * Whether this adapter can natively filter by the given category. Adapters
   * without native support are excluded from category-filtered searches so
   * they cannot dilute the results with unfiltered matches.
   */
  supportsCategory?(category: ModelCategory): boolean;
}

export interface AdapterFailure {
  platform: SourcePlatform;
  error: string;
}

export interface AggregatedSearchResult {
  results: UnifiedModelResult[];
  /** Platforms whose adapter rejected; the merged results above exclude them. */
  failures: AdapterFailure[];
}
