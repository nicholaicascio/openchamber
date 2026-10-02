import { getCurrentIntlLocale } from '@/lib/i18n';

/**
 * Bundled monthly usage allowances for OpenCode Go models, in whole USD, for
 * the Go ($10/month) and Go Plus ($40/month) plans.
 *
 * Source: https://opencode.ai/docs/go/#usage-limits (both plan tabs), checked
 * 2026-10-01. No OpenCode or Go API publishes this: `/v1/models` lists ids,
 * `/v1/usage` answers account percentages, and the model catalog has token
 * prices but no allowance. The map below is the offline answer, and the
 * server refreshes it from `docs/go.md` daily (see
 * `packages/web/server/lib/quota/go-monthly-usage.js`); `selectGoMonthlyUsage`
 * prefers the refreshed table once it has loaded.
 *
 * Keyed by the model id the `opencode-go` provider serves
 * (`opencode-go/<model-id>`). The source table splits some models by context
 * tier or peak/off-peak hours; those rows share one allowance and collapse
 * onto the base id here. A model absent from both tables has no known
 * allowance, and callers hide the row rather than guess: the lineup changes
 * as models are added and retired.
 */
export type GoMonthlyUsage = { go: number; goPlus: number } | 'unlimited';

const OPENCODE_GO_PROVIDER_ID = 'opencode-go';

const GO_MONTHLY_USAGE = new Map<string, GoMonthlyUsage>(Object.entries({
  'glm-5.3-flash': { go: 60, goPlus: 180 },
  'glm-5.3': { go: 15, goPlus: 120 },
  'glm-5.2': { go: 60, goPlus: 180 },
  'kimi-k3': { go: 15, goPlus: 60 },
  'kimi-k2.7-code': { go: 60, goPlus: 180 },
  'kimi-k2.6': { go: 60, goPlus: 240 },
  'longcat-2.0': { go: 60, goPlus: 240 },
  'longcat-2.5-preview-free': 'unlimited',
  'mimo-v2.6-flash': { go: 60, goPlus: 120 },
  'mimo-v2.6-pro': { go: 15, goPlus: 60 },
  'mimo-v2.5': { go: 60, goPlus: 120 },
  'mimo-v2.5-pro': { go: 15, goPlus: 60 },
  'minimax-m3': { go: 60, goPlus: 180 },
  'minimax-m2.7': { go: 60, goPlus: 240 },
  'muse-spark-1.3-contributor': { go: 60, goPlus: 120 },
  'muse-spark-1.2-contributor': { go: 60, goPlus: 120 },
  'qwen3.8-max': { go: 15, goPlus: 60 },
  'qwen3.8-flash': { go: 30, goPlus: 90 },
  'qwen3.7-plus': { go: 60, goPlus: 180 },
  'deepseek-v4.1-flash': { go: 60, goPlus: 120 },
  'deepseek-v4-pro': { go: 15, goPlus: 60 },
  'deepseek-v4-flash': { go: 30, goPlus: 120 },
  'deepseek-v4-flash-vision-exp': { go: 15, goPlus: 60 },
  'hy4-preview': { go: 30, goPlus: 120 },
  'hy3': { go: 60, goPlus: 240 },
  'space-bunny-free': 'unlimited',
  'grok-4.7': { go: 15, goPlus: 60 },
  'grok-4.6': { go: 15, goPlus: 60 },
  'gpt-6-luna': { go: 15, goPlus: 60 },
  'gpt-5.6-luna': { go: 15, goPlus: 60 },
} satisfies Record<string, GoMonthlyUsage>));

/**
 * The allowance to show for a model, or `undefined` when nothing should be
 * shown (a non-Go provider, or a model no table lists).
 *
 * `live` is the refreshed table from the docs; while it has not loaded
 * (`null`) the bundled copy answers. Once loaded, the live table is
 * authoritative — including for a model it omits, which is how a retired
 * allowance stops being shown.
 */
export const selectGoMonthlyUsage = (
  live: Record<string, GoMonthlyUsage> | null,
  providerId: string,
  modelId: string,
): GoMonthlyUsage | undefined => {
  if (providerId !== OPENCODE_GO_PROVIDER_ID) return undefined;
  if (live) return live[modelId];
  return GO_MONTHLY_USAGE.get(modelId);
};

/**
 * `Go $15 · Go Plus $60`. Plan names are product names and stay literal;
 * only the amounts follow the UI locale. Whole dollars match how the limits
 * are published, so no fraction digits.
 */
export const formatGoMonthlyUsage = (usage: { go: number; goPlus: number }): string => {
  const format = (value: number) => new Intl.NumberFormat(getCurrentIntlLocale(), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
  return `Go ${format(usage.go)} · Go Plus ${format(usage.goPlus)}`;
};
