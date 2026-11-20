/// <reference types="node" />
// Reads source files from disk: the native app (mobile/) imports src/logic directly, so the rules
// must not reach into web-only code.
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const importsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1])

describe('the shared rules stand alone', () => {
  const dir = resolve(process.cwd(), 'src/logic')
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.ts'))) {
    it(`${name} imports only its neighbours and date-fns`, () => {
      for (const path of importsOf(resolve(dir, name))) {
        expect(path === 'date-fns' || /^\.\/[A-Za-z]+$/.test(path), path).toBe(true)
      }
    })
  }

  it('the data types import only the rules', () => {
    for (const path of importsOf(resolve(process.cwd(), 'src/db/types.ts'))) {
      expect(path.startsWith('../logic/'), path).toBe(true)
    }
  })
})
