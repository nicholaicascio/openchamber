import { describe, expect, test } from 'bun:test';

import { formatGoMonthlyUsage, selectGoMonthlyUsage, type GoMonthlyUsage } from './goMonthlyLimits';

describe('selectGoMonthlyUsage', () => {
  test('answers from the bundled table before a live table has loaded', () => {
    expect(selectGoMonthlyUsage(null, 'opencode-go', 'kimi-k3')).toEqual({ go: 15, goPlus: 60 });
    expect(selectGoMonthlyUsage(null, 'opencode-go', 'space-bunny-free')).toBe('unlimited');
  });

  test('prefers the refreshed table once it has loaded', () => {
    const live = { 'kimi-k3': { go: 20, goPlus: 80 } } satisfies Record<string, GoMonthlyUsage>;
    expect(selectGoMonthlyUsage(live, 'opencode-go', 'kimi-k3')).toEqual({ go: 20, goPlus: 80 });
  });

  test('hides a model the loaded table omits, even if the bundle lists it', () => {
    // The refreshed table is authoritative: a model it does not list has no
    // allowance to show, however stale the bundled copy is.
    expect(selectGoMonthlyUsage({}, 'opencode-go', 'kimi-k3')).toBeUndefined();
  });

  test('stays off other providers', () => {
    expect(selectGoMonthlyUsage(null, 'anthropic', 'kimi-k3')).toBeUndefined();
    expect(selectGoMonthlyUsage({ 'kimi-k3': { go: 20, goPlus: 80 } }, 'openai', 'kimi-k3')).toBeUndefined();
  });

  test('shows nothing for a model no table lists', () => {
    expect(selectGoMonthlyUsage(null, 'opencode-go', 'gpt-5.2')).toBeUndefined();
  });
});

describe('formatGoMonthlyUsage', () => {
  test('names both plans with their amounts', () => {
    const text = formatGoMonthlyUsage({ go: 15, goPlus: 60 });
    expect(text).toContain('Go');
    expect(text).toContain('Go Plus');
    expect(text).toContain('15');
    expect(text).toContain('60');
  });
});
