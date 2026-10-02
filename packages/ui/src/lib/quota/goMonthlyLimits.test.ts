import { describe, expect, test } from 'bun:test';

import { formatGoMonthlyUsage, getGoMonthlyUsage } from './goMonthlyLimits';

describe('getGoMonthlyUsage', () => {
  test('returns the plan pair for a listed Go model', () => {
    expect(getGoMonthlyUsage('opencode-go', 'kimi-k3')).toEqual({ go: 15, goPlus: 60 });
    expect(getGoMonthlyUsage('opencode-go', 'mimo-v2.6-flash')).toEqual({ go: 60, goPlus: 120 });
  });

  test('reports the limited-time free models as unlimited', () => {
    expect(getGoMonthlyUsage('opencode-go', 'space-bunny-free')).toBe('unlimited');
    expect(getGoMonthlyUsage('opencode-go', 'longcat-2.5-preview-free')).toBe('unlimited');
  });

  test('returns undefined for a model outside the published lineup', () => {
    expect(getGoMonthlyUsage('opencode-go', 'gpt-5.2')).toBeUndefined();
  });

  test('stays off other providers', () => {
    // The allowance belongs to the Go plan; another provider's model with the
    // same id must not borrow it.
    expect(getGoMonthlyUsage('anthropic', 'kimi-k3')).toBeUndefined();
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
