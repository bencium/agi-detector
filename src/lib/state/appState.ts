import { execute, queryOne } from '@/lib/db';

let appStateEnsured = false;

export async function ensureAppStateSchema(): Promise<void> {
  if (appStateEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS "AppState" (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    appStateEnsured = true;
  } catch (error) {
    console.warn('[AppState] Failed to ensure schema:', error);
  }
}

export async function setAppState(key: string, value: unknown): Promise<void> {
  await ensureAppStateSchema();
  const payload = JSON.stringify(value ?? null);
  await execute(
    `INSERT INTO "AppState"(key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, "updatedAt" = CURRENT_TIMESTAMP`,
    [key, payload]
  );
}

export async function getAppState<T = unknown>(key: string): Promise<T | null> {
  await ensureAppStateSchema();
  const row = await queryOne<{ value: T }>(
    `SELECT value FROM "AppState" WHERE key = $1`,
    [key]
  );
  return row?.value ?? null;
}

export async function setLastCrawlRunAt(timestamp: string): Promise<void> {
  await setAppState('lastCrawlRunAt', { timestamp });
}

export async function getLastCrawlRunAt(): Promise<string | null> {
  const value = await getAppState<{ timestamp?: string }>('lastCrawlRunAt');
  return value?.timestamp ?? null;
}
