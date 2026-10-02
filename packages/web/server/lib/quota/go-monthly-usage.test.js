import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TTL_MS,
  GO_MONTHLY_USAGE_URL,
  getGoMonthlyUsageTable,
  parseGoMonthlyUsage,
  resetGoMonthlyUsageCache,
} from './go-monthly-usage.js';

const endpointsTable = `
| Model                        | Model ID                     | Endpoint                          |
| ---------------------------- | ---------------------------- | --------------------------------- |
| GLM-5.3-Flash                | glm-5.3-flash                | \`https://example.invalid/chat\`    |
| GLM-5.3                      | glm-5.3                      | \`https://example.invalid/chat\`    |
| Kimi K3                      | kimi-k3                      | \`https://example.invalid/chat\`    |
| Kimi K2.7 Code               | kimi-k2.7-code               | \`https://example.invalid/chat\`    |
| LongCat-2.0                  | longcat-2.0                  | \`https://example.invalid/chat\`    |
| LongCat 2.5 Preview Free     | longcat-2.5-preview-free     | \`https://example.invalid/chat\`    |
| MiMo-V2.6-Flash              | mimo-v2.6-flash              | \`https://example.invalid/chat\`    |
| MiniMax M3                   | minimax-m3                   | \`https://example.invalid/chat\`    |
| Qwen3.7 Plus                 | qwen3.7-plus                 | \`https://example.invalid/chat\`    |
| DeepSeek V4.1 Flash          | deepseek-v4.1-flash          | \`https://example.invalid/chat\`    |
| Grok 4.7                     | grok-4.7                     | \`https://example.invalid/chat\`    |
| GPT 6 Luna                   | gpt-6-luna                   | \`https://example.invalid/chat\`    |
`;

const planTable = (rows) => `
| Model                                   | Input  | Output | Cached Read | Cached Write | Monthly limit                                  |
| --------------------------------------- | ------ | ------ | ----------- | ------------ | ---------------------------------------------- |
${rows}
`;

const goRows = [
  '| GLM-5.3-Flash                           | $0.15  | $0.50  | $0.03       | -            | **$60**                                        |',
  '| GLM-5.3                                 | $1.40  | $4.40  | $0.26       | -            | **$15**                                        |',
  '| Kimi K3                                 | $3.00  | $15.00 | $0.30       | -            | **$15**                                        |',
  '| Kimi K2.7 Code                          | $0.95  | $4.00  | $0.19       | -            | **$60**                                        |',
  '| LongCat-2.0                             | $0.30  | $1.20  | $0.006      | -            | **$60**                                        |',
  '| LongCat 2.5 Preview Free                | Free   | Free   | Free        | -            | **Unlimited**<br /><small>limited time</small> |',
  '| MiMo-V2.6-Flash                         | $0.14  | $0.28  | $0.0028     | -            | **$60**                                        |',
  '| MiniMax M3                              | $0.30  | $1.20  | $0.06       | -            | **$60**                                        |',
  '| Qwen3.7 Plus (≤ 256K tokens)            | $0.40  | $1.60  | $0.04       | $0.50        | **$60**                                        |',
  '| Qwen3.7 Plus (> 256K tokens)            | $1.20  | $4.80  | $0.12       | $1.50        | **$60**                                        |',
  '| DeepSeek V4.1 Flash (Off-Peak)          | $0.15  | $0.60  | $0.003      | -            | **$60**                                        |',
  '| Grok 4.7 (≤ 200K tokens)                | $2.00  | $6.00  | $0.50       | -            | **$15**                                        |',
  '| Grok 4.7 (> 200K tokens)                | $4.00  | $12.00 | $1.00       | -            | **$15**                                        |',
  '| GPT 6 Luna (≤ 272K tokens)              | $0.10  | $0.50  | $0.01       | $0.125       | **$15**                                        |',
].join('\n');

const plusRows = [
  '| GLM-5.3-Flash                           | $0.15  | $0.50  | $0.03       | -            | **$180**                                       |',
  '| GLM-5.3                                 | $1.40  | $4.40  | $0.26       | -            | **$120**                                       |',
  '| Kimi K3                                 | $3.00  | $15.00 | $0.30       | -            | **$60**                                        |',
  '| Kimi K2.7 Code                          | $0.95  | $4.00  | $0.19       | -            | **$180**                                       |',
  '| LongCat-2.0                             | $0.30  | $1.20  | $0.006      | -            | **$240**                                       |',
  '| LongCat 2.5 Preview Free                | Free   | Free   | Free        | -            | **Unlimited**<br /><small>limited time</small> |',
  '| MiMo-V2.6-Flash                         | $0.14  | $0.28  | $0.0028     | -            | **$120**                                       |',
  '| MiniMax M3                              | $0.30  | $1.20  | $0.06       | -            | **$180**                                       |',
  '| Qwen3.7 Plus (≤ 256K tokens)            | $0.40  | $1.60  | $0.04       | $0.50        | **$180**                                       |',
  '| Qwen3.7 Plus (> 256K tokens)            | $1.20  | $4.80  | $0.12       | $1.50        | **$180**                                       |',
  '| DeepSeek V4.1 Flash (Off-Peak)          | $0.15  | $0.60  | $0.003      | -            | **$120**                                       |',
  '| Grok 4.7 (≤ 200K tokens)                | $2.00  | $6.00  | $0.50       | -            | **$60**                                        |',
  '| Grok 4.7 (> 200K tokens)                | $4.00  | $12.00 | $1.00       | -            | **$60**                                        |',
  '| GPT 6 Luna (≤ 272K tokens)              | $0.10  | $0.50  | $0.01       | $0.125       | **$60**                                        |',
].join('\n');

const docs = `
## Usage limits

<Tabs syncKey="go-plan">
  <TabItem label="Go">

${planTable(goRows)}
  </TabItem>
  <TabItem label="Go Plus">

${planTable(plusRows)}
  </TabItem>
</Tabs>

## Estimated requests

<Tabs syncKey="go-requests">
  <TabItem label="Go">

    | Model | Requests per 5 hours |
    | ----- | -------------------- |
    | Kimi K3 | 110 |

  </TabItem>
  <TabItem label="Go Plus">

    | Model | Requests per 5 hours |
    | ----- | -------------------- |
    | Kimi K3 | 440 |

  </TabItem>
</Tabs>

## Endpoints

${endpointsTable}
`;

const jsonResponse = (body) => new Response(body, {
  status: 200,
  headers: { 'content-type': 'text/plain' },
});

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  resetGoMonthlyUsageCache();
});

describe('parseGoMonthlyUsage', () => {
  it('joins the plan tables with the model id table', () => {
    const models = parseGoMonthlyUsage(docs);
    expect(models['kimi-k3']).toEqual({ go: 15, goPlus: 60 });
    expect(models['glm-5.3-flash']).toEqual({ go: 60, goPlus: 180 });
    expect(models['gpt-6-luna']).toEqual({ go: 15, goPlus: 60 });
  });

  it('collapses context-tier and peak rows onto the base model id', () => {
    const models = parseGoMonthlyUsage(docs);
    expect(models['qwen3.7-plus']).toEqual({ go: 60, goPlus: 180 });
    expect(models['grok-4.7']).toEqual({ go: 15, goPlus: 60 });
    expect(models['deepseek-v4.1-flash']).toEqual({ go: 60, goPlus: 120 });
  });

  it('reads the limited-time free models as unlimited', () => {
    const models = parseGoMonthlyUsage(docs);
    expect(models['longcat-2.5-preview-free']).toBe('unlimited');
  });

  it('drops a model whose plans disagree on unlimited', () => {
    const mixed = docs
      .replace('| **Unlimited**<br /><small>limited time</small> |', '| **$60**                                        |');
    const models = parseGoMonthlyUsage(mixed);
    expect(models['longcat-2.5-preview-free']).toBeUndefined();
  });

  it('ignores the estimated-request tabs', () => {
    // Only the tables with a Monthly limit column are plan data.
    const models = parseGoMonthlyUsage(docs);
    expect(Object.keys(models)).toHaveLength(12);
  });

  it('rejects a document with no model id table', () => {
    expect(() => parseGoMonthlyUsage('<TabItem label="Go">no table</TabItem>')).toThrow(/model id table/);
  });

  it('rejects a partial table instead of reporting a made-up lineup', () => {
    const partial = `
<TabItem label="Go">
${planTable(goRows.slice(0, 2))}
</TabItem>
<TabItem label="Go Plus">
${planTable(plusRows.slice(0, 2))}
</TabItem>
${endpointsTable}
`;
    expect(() => parseGoMonthlyUsage(partial)).toThrow(/complete allowance table/);
  });

  it('rejects an empty document', () => {
    expect(() => parseGoMonthlyUsage('')).toThrow(/empty/);
  });
});

describe('getGoMonthlyUsageTable', () => {
  it('fetches once and serves the copy while the TTL holds', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(docs));
    const first = await getGoMonthlyUsageTable({ fetchImpl, ttlMs: DEFAULT_TTL_MS });
    const second = await getGoMonthlyUsageTable({ fetchImpl, ttlMs: DEFAULT_TTL_MS });
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.models['kimi-k3']).toEqual({ go: 15, goPlus: 60 });
  });

  it('keeps the last good table when a refresh fails', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(docs));
    await getGoMonthlyUsageTable({ fetchImpl, ttlMs: 0 });
    const failingFetch = vi.fn(async () => { throw new Error('offline'); });
    const next = await getGoMonthlyUsageTable({ fetchImpl: failingFetch, ttlMs: 0 });
    expect(next.stale).toBe(true);
    expect(next.models['kimi-k3']).toEqual({ go: 15, goPlus: 60 });
  });

  it('rejects a truncated page instead of caching it', async () => {
    const truncated = `<TabItem label="Go">${planTable(goRows.slice(0, 3))}</TabItem>${endpointsTable}`;
    const fetchImpl = vi.fn(async () => jsonResponse(truncated));
    await expect(getGoMonthlyUsageTable({ fetchImpl, ttlMs: 0 })).rejects.toThrow(/complete allowance table/);
  });

  it('requests the markdown docs, not the rendered page', () => {
    expect(GO_MONTHLY_USAGE_URL).toBe('https://opencode.ai/docs/go.md');
  });
});
