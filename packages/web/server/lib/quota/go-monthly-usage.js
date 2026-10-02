/**
 * OpenCode Go monthly usage allowances, parsed from the public Go docs.
 *
 * The allowances are plan data (`$15` a month on Go, `$60` on Go Plus, per
 * model) that no OpenCode or Go API carries: `/v1/models` lists ids only,
 * `/v1/usage` answers account percentages, and the model catalog has token
 * prices but no allowance. The docs page is the only published source, and
 * `docs/go.md` is that page as plain markdown — stable tables instead of
 * rendered HTML.
 *
 * The client ships a bundled table as its offline fallback; this module is the
 * optional live refresh behind it. A parse that does not look complete is
 * rejected rather than allowed to replace a good table.
 */

export const GO_MONTHLY_USAGE_URL = 'https://opencode.ai/docs/go.md';
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;
// Both plan tables list the same lineup. Fewer rows than this means the page
// changed shape or we read a fragment, not a real Go catalog.
const MIN_MODELS = 10;

const PLAN_COLUMNS = { Go: 'go', 'Go Plus': 'goPlus' };

/** Markdown runs of `| a | b |` lines; the first row of each run is its header. */
const parseTables = (block) => {
  const tables = [];
  let current = null;
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      current = null;
      continue;
    }
    const cells = trimmed.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell) || cell.length === 0)) continue;
    if (!current) {
      current = [];
      tables.push(current);
    }
    current.push(cells);
  }
  return tables;
};

const plainText = (value) => String(value)
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/\*\*/g, '')
  .replace(/\\/g, '')
  .trim();

const parseAllowance = (cell) => {
  const text = plainText(cell);
  if (/^unlimited/i.test(text)) return 'unlimited';
  const amount = /^\$([\d.,]+)$/.exec(text);
  if (!amount) return undefined;
  const value = Number(amount[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
};

/** `Qwen3.7 Plus (≤ 256K tokens)` and peak/off-peak rows share the base model. */
const baseModelName = (name) => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

const findColumn = (header, label) => header.indexOf(label);

/**
 * The docs file interleaves the plan tabs with the endpoint table that names
 * each model id. Joins them; a name no table resolves is dropped, never
 * guessed.
 */
export const parseGoMonthlyUsage = (markdown) => {
  if (!markdown || markdown.trim().length === 0) {
    throw new Error('Go usage docs are empty');
  }

  const idByName = new Map();
  for (const table of parseTables(markdown)) {
    const idColumn = findColumn(table[0], 'Model ID');
    if (idColumn === -1) continue;
    for (const row of table.slice(1)) {
      const modelId = plainText(row[idColumn]);
      const name = plainText(row[0]);
      if (modelId && name) idByName.set(name, modelId);
    }
  }
  if (idByName.size === 0) {
    throw new Error('Go usage docs carry no model id table');
  }

  const byModelId = new Map();
  for (const tab of markdown.matchAll(/<TabItem label="([^"]+)">([\s\S]*?)<\/TabItem>/g)) {
    const plan = PLAN_COLUMNS[tab[1]];
    if (!plan) continue;

    for (const table of parseTables(tab[2])) {
      const limitColumn = findColumn(table[0], 'Monthly limit');
      if (limitColumn === -1) continue;

      for (const row of table.slice(1)) {
        if (row.length <= limitColumn) continue;
        const allowance = parseAllowance(row[limitColumn]);
        if (allowance === undefined) continue;
        const modelId = idByName.get(baseModelName(plainText(row[0])));
        if (!modelId) continue;
        const entry = byModelId.get(modelId) ?? {};
        entry[plan] = allowance;
        byModelId.set(modelId, entry);
      }
    }
  }

  const models = {};
  for (const [modelId, entry] of byModelId) {
    // Both plans must have answered: half a pair would show a made-up one.
    if (entry.go === undefined || entry.goPlus === undefined) continue;
    if (entry.go === 'unlimited' || entry.goPlus === 'unlimited') {
      // The tooltip shows the pair as one row; unlimited on both plans is the
      // shape it can state. A mix it cannot express is dropped, not guessed.
      if (entry.go === 'unlimited' && entry.goPlus === 'unlimited') models[modelId] = 'unlimited';
      continue;
    }
    models[modelId] = { go: entry.go, goPlus: entry.goPlus };
  }
  if (Object.keys(models).length < MIN_MODELS) {
    throw new Error('Go usage docs did not parse into a complete allowance table');
  }
  return models;
};

let cached = null;
let cachedAt = 0;
let inflight = null;

/** Test seam: the module owns one process-wide cache. */
export const resetGoMonthlyUsageCache = () => {
  cached = null;
  cachedAt = 0;
  inflight = null;
};

const fetchDocs = async (url, timeoutMs, fetchImpl) => {
  const response = await fetchImpl(url, {
    headers: { Accept: 'text/plain,text/markdown' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Go usage docs responded with status ${response.status}`);
  }
  return parseGoMonthlyUsage(await response.text());
};

/**
 * The parsed allowance table, served from the in-memory copy while fresh. A
 * failed refresh keeps the last good table; only a first-ever failure throws.
 */
export async function getGoMonthlyUsageTable({
  url = GO_MONTHLY_USAGE_URL,
  ttlMs = DEFAULT_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  const now = Date.now();
  if (cached && now - cachedAt < ttlMs) {
    return { models: cached, fromCache: true };
  }
  if (!inflight) {
    inflight = fetchDocs(url, timeoutMs, fetchImpl).finally(() => { inflight = null; });
  }
  try {
    const models = await inflight;
    cached = models;
    cachedAt = Date.now();
    return { models, fromCache: false };
  } catch (error) {
    if (cached) return { models: cached, fromCache: true, stale: true };
    throw error;
  }
}
