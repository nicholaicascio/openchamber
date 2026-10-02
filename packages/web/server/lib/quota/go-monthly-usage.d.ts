export type GoMonthlyUsage = { go: number; goPlus: number } | 'unlimited';

export type GoMonthlyUsageTable = Record<string, GoMonthlyUsage>;

export type GoMonthlyUsageOptions = {
  url?: string;
  ttlMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export declare const GO_MONTHLY_USAGE_URL: string;
export declare const DEFAULT_TTL_MS: number;

export declare function parseGoMonthlyUsage(markdown: string): GoMonthlyUsageTable;
export declare function resetGoMonthlyUsageCache(): void;
export declare function getGoMonthlyUsageTable(options?: GoMonthlyUsageOptions): Promise<{
  models: GoMonthlyUsageTable;
  fromCache: boolean;
  stale?: boolean;
}>;
