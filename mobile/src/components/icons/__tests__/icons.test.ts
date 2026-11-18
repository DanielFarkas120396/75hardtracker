/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ICON_NAMES } from '../icons'

// Everything from the first drawing on, with the shapes' names in one spelling.
const drawings = (file: string) => {
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  return source.slice(source.indexOf('export const ICONS')).replace(/<(\/?)(Path|Circle|Rect|G)\b/g, (_all, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}`)
}

it('draws every icon exactly as the web app does', () => {
  const web = join(__dirname, '../../../../../src/components/icons/icons.tsx')
  expect(drawings(join(__dirname, '../icons.tsx'))).toBe(drawings(web))
  expect(ICON_NAMES).toContain('workout')
})
