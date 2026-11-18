import { Directory, File, Paths } from 'expo-file-system'

/**
 * The few file operations the app needs, on paths relative to its documents
 * folder ("pictures/photos/5.jpg"). The phone uses `expoStore`; tests use a
 * temp folder with the same shape (see __tests__/nodeStore.ts).
 */
export interface FileStore {
  /** Writes a file from base64, creating its folders. Replaces a file already there. */
  writeBase64(path: string, base64: string): Promise<void>
  /** Copies a file from anywhere on the phone (a `file://` address) to `path`, creating its folders. Replaces a file already there. */
  copyIn(fromUri: string, path: string): Promise<void>
  /** Deletes one file. Fine if it isn't there. */
  deleteFile(path: string): void
  /** Creates the folder and those above it. Fine if it exists. */
  makeFolder(path: string): void
  exists(path: string): boolean
  /** Deletes a folder and everything in it. Fine if it isn't there. */
  deleteFolder(path: string): void
  /** Renames a top-level folder. The new name must be free. */
  renameFolder(from: string, to: string): void
  /** The address an <Image> can load. */
  uri(path: string): string
}

const folderOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))

export const expoStore: FileStore = {
  async writeBase64(path, base64) {
    this.makeFolder(folderOf(path))
    const file = new File(Paths.document, path)
    file.create({ overwrite: true })
    await file.write(base64, { encoding: 'base64' })
  },
  async copyIn(fromUri, path) {
    this.makeFolder(folderOf(path))
    await new File(fromUri).copy(new File(Paths.document, path), { overwrite: true })
  },
  deleteFile(path) {
    const file = new File(Paths.document, path)
    if (file.exists) file.delete()
  },
  makeFolder(path) {
    if (path !== '') new Directory(Paths.document, path).create({ intermediates: true, idempotent: true })
  },
  exists(path) {
    return new Directory(Paths.document, path).exists || new File(Paths.document, path).exists
  },
  deleteFolder(path) {
    const folder = new Directory(Paths.document, path)
    if (folder.exists) folder.delete()
  },
  renameFolder(from, to) {
    new Directory(Paths.document, from).rename(to)
  },
  uri(path) {
    return new File(Paths.document, path).uri
  },
}
