import { HardTrackerDB } from './schema'

export const DEFAULT_DB_NAME = 'HardTrackerDB'

/**
 * Dev only: `?db=<name>` opens a separate database (used by the seeded test
 * scenarios in src/dev/scenarios.ts), so experiments never touch your real
 * data. Production builds always use the default database.
 */
function databaseName(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const scenario = new URLSearchParams(window.location.search).get('db')
    if (scenario) return `${DEFAULT_DB_NAME}-${scenario}`
  }
  return DEFAULT_DB_NAME
}

export const db = new HardTrackerDB(databaseName())
