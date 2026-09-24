import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'

export interface StorageStatus {
  usageBytes?: number
  quotaBytes?: number
  /** undefined when the browser has no Storage API. */
  persisted?: boolean
}

function storageManager(): StorageManager | undefined {
  return typeof navigator !== 'undefined' ? navigator.storage : undefined
}

/**
 * On first launch, asks the browser to keep this app's data from being
 * evicted under storage pressure. There's no backend, so losing IndexedDB
 * would lose everything. Asks only once; Settings offers to ask again.
 */
export async function requestPersistenceOnce(): Promise<void> {
  const storage = storageManager()
  if (!storage?.persist || !storage.persisted) return
  if (await settingsRepo.get(SETTING_KEYS.persistRequested, false)) return
  await settingsRepo.set(SETTING_KEYS.persistRequested, true)
  if (!(await storage.persisted())) await storage.persist()
}

/** Asks for persistent storage now (from a button). Resolves to whether storage is persisted afterwards. */
export async function requestPersistence(): Promise<boolean> {
  const storage = storageManager()
  if (!storage?.persist) return false
  return storage.persist()
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = storageManager()
  if (!storage) return {}
  const [estimate, persisted] = await Promise.all([
    storage.estimate ? storage.estimate() : Promise.resolve(undefined),
    storage.persisted ? storage.persisted() : Promise.resolve(undefined),
  ])
  return { usageBytes: estimate?.usage, quotaBytes: estimate?.quota, persisted }
}

/** "12.3 MB"-style sizes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
