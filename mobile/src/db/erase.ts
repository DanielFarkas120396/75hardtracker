import { discardStaged } from '../files/pictures'
import type { FileStore } from '../files/store'
import { transaction } from './open'
import { TABLE_NAMES } from './schema'

/**
 * Deletes everything on this phone: every row and every picture. The app is
 * then as on a first launch, and the welcome flow shows again. The web's resetAll.
 */
export async function eraseEverything(store: FileStore): Promise<void> {
  await transaction(async (db) => {
    for (const table of TABLE_NAMES) await db.execAsync(`DELETE FROM ${table}`)
  })
  discardStaged(store)
  store.deleteFolder('pictures')
}
