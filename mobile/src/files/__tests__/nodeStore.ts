import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FileStore } from '../store'

/** The FileStore over a real folder on this computer, for tests. */
export function nodeStore(root: string): FileStore {
  return {
    async writeBase64(path, base64) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), Buffer.from(base64, 'base64'))
    },
    makeFolder(path) {
      mkdirSync(join(root, path), { recursive: true })
    },
    exists(path) {
      return existsSync(join(root, path))
    },
    deleteFolder(path) {
      rmSync(join(root, path), { recursive: true, force: true })
    },
    renameFolder(from, to) {
      if (existsSync(join(root, to))) throw new Error(`${to} already exists`)
      renameSync(join(root, from), join(root, to))
    },
    uri(path) {
      return pathToFileURL(join(root, path)).href
    },
  }
}
