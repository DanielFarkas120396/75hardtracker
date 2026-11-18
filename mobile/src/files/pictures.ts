import type { FileStore } from './store'

/**
 * Progress photos and book covers are files, not database rows:
 *
 *   pictures/photos/<photo id>.<ext>
 *   pictures/covers/<book id>.<ext>
 *
 * An import writes a whole new set beside the current one (pictures-incoming)
 * and swaps the two only once the database has been replaced, so an import
 * that fails leaves the current pictures as they were.
 */
export type PictureFolder = 'photos' | 'covers'

const CURRENT = 'pictures'
const INCOMING = 'pictures-incoming'
const OUTGOING = 'pictures-outgoing'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'img'
}

export interface StagedPicture {
  folder: PictureFolder
  id: number
  base64: string
  mimeType: string
}

/**
 * Writes a new set of pictures beside the current one. Returns each
 * picture's file name by "<folder>/<id>" ("photos/5" → "5.jpg").
 */
export async function stagePictures(store: FileStore, pictures: StagedPicture[]): Promise<Map<string, string>> {
  // Anything left by an import that died halfway.
  store.deleteFolder(INCOMING)
  store.makeFolder(`${INCOMING}/photos`)
  store.makeFolder(`${INCOMING}/covers`)
  const names = new Map<string, string>()
  for (const picture of pictures) {
    const name = `${picture.id}.${extensionFor(picture.mimeType)}`
    await store.writeBase64(`${INCOMING}/${picture.folder}/${name}`, picture.base64)
    names.set(`${picture.folder}/${picture.id}`, name)
  }
  return names
}

/** Makes the staged pictures the current ones, and removes the old set. */
export function commitStaged(store: FileStore): void {
  store.deleteFolder(OUTGOING)
  if (store.exists(CURRENT)) store.renameFolder(CURRENT, OUTGOING)
  store.renameFolder(INCOMING, CURRENT)
  store.deleteFolder(OUTGOING)
}

/** Drops the staged pictures. The current ones are untouched. */
export function discardStaged(store: FileStore): void {
  store.deleteFolder(INCOMING)
}

/** The address of a current picture, for an <Image>. */
export function pictureUri(store: FileStore, folder: PictureFolder, file: string): string {
  return store.uri(`${CURRENT}/${folder}/${file}`)
}
