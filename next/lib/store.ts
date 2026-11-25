import { env, configured } from './env';
import { memoryStore } from './store-memory';
import { supabaseStore } from './store-supabase';
import type { Store } from './types';

const g = globalThis as unknown as { __rruStore?: Store };

/** The data store: Supabase when configured, memory in LOCAL_MODE (tests / trying it on a laptop). */
export function store(): Store {
  if (g.__rruStore) return g.__rruStore;
  if (configured()) g.__rruStore = supabaseStore(env.supabaseUrl, env.supabaseSecretKey);
  else if (env.localMode) g.__rruStore = memoryStore();
  else throw new Error('The app is not set up yet: add the Supabase settings in Vercel.');
  return g.__rruStore;
}

/** Tests only. */
export function setStore(s: Store | undefined) { g.__rruStore = s; }
