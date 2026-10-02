import React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { z } from 'zod';

import { runtimeFetch } from '@/lib/runtime-fetch';
import { getRuntimeKey, isTransientRuntimeKey, subscribeRuntimeEndpointChanged } from '@/lib/runtime-switch';
import type { GoMonthlyUsage } from '@/lib/quota/goMonthlyLimits';
import { useConfigStore } from '@/stores/useConfigStore';

type GoMonthlyUsageTable = Record<string, GoMonthlyUsage>;

const payloadSchema = z.object({
  models: z.record(z.string(), z.union([
    z.literal('unlimited'),
    z.object({ go: z.number(), goPlus: z.number() }),
  ])),
});

// The table belongs to the connected instance, so it is dropped on a runtime
// switch. Bumped on every reset so a response in flight for the previous
// instance cannot land in the new one.
let generation = 0;
let inFlight: Promise<void> | null = null;

interface GoMonthlyUsageStore {
  /** `null` until the live table has loaded; the bundled table answers meanwhile. */
  models: GoMonthlyUsageTable | null;
  loadedRuntimeKey: string | null;
  ensureLoaded: () => Promise<void>;
}

const useGoMonthlyUsageStore = create<GoMonthlyUsageStore>()(
  devtools(
    (set, get) => ({
      models: null,
      loadedRuntimeKey: null,

      ensureLoaded: async () => {
        const runtimeKey = getRuntimeKey();
        if (isTransientRuntimeKey(runtimeKey)) return;
        // Asking before the instance reports itself initialised gets a
        // connection error, which must not be cached as "no live table".
        if (!useConfigStore.getState().isInitialized) return;
        if (get().loadedRuntimeKey === runtimeKey) return;
        if (inFlight) return inFlight;

        const current = generation;
        inFlight = (async () => {
          try {
            const response = await runtimeFetch('/api/openchamber/go-monthly-usage');
            if (!response.ok) {
              throw new Error(`Go monthly usage request failed (${response.status})`);
            }
            const { models } = payloadSchema.parse(await response.json());
            if (current !== generation) return;
            set({ models, loadedRuntimeKey: runtimeKey });
          } catch (error) {
            // A failed refresh keeps the bundled table as the answer. It is
            // never recorded as loaded, so a later mount retries.
            if (current === generation) {
              console.warn('Failed to load the OpenCode Go monthly usage table:', error);
            }
          } finally {
            if (current === generation) inFlight = null;
          }
        })();

        return inFlight;
      },
    }),
    { name: 'go-monthly-usage-store' },
  ),
);

subscribeRuntimeEndpointChanged(() => {
  generation += 1;
  inFlight = null;
  useGoMonthlyUsageStore.setState({ models: null, loadedRuntimeKey: null });
});

/**
 * The live allowance table, loaded once per instance on first use. Consumers
 * fall back to the bundled table while it is `null`.
 */
export const useGoMonthlyUsageTable = (): GoMonthlyUsageTable | null => {
  const models = useGoMonthlyUsageStore((state) => state.models);
  const initialized = useConfigStore((state) => state.isInitialized);

  React.useEffect(() => {
    if (!initialized) return;
    void useGoMonthlyUsageStore.getState().ensureLoaded();
  }, [initialized]);

  return models;
};
