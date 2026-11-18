/** @jest-environment node */
// The app reaches the web app's code only through @logic/* (src/logic) and @schema
// (src/db/types.ts): everything else in ../src is web-only (Dexie, the DOM).
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const importsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1])

it('finds the app’s source files', () => {
  expect(sourceFiles(join(ROOT, 'src')).length).toBeGreaterThan(2)
})

it.each(sourceFiles(join(ROOT, 'src')).map((file) => [relative(ROOT, file), file]))(
  '%s stays inside mobile/',
  (_name, file) => {
    for (const path of importsOf(file)) {
      if (path.startsWith('.')) {
        expect(relative(ROOT, resolve(dirname(file), path)).startsWith('..')).toBe(false)
      } else if (path.startsWith('@')) {
        expect(path.startsWith('@web')).toBe(false)
      }
    }
  },
)
