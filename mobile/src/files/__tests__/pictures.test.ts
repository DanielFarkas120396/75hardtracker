/** @jest-environment node */
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commitStaged, discardStaged, extensionFor, pictureUri, stagePictures } from '../pictures'
import { nodeStore } from './nodeStore'

const base64 = (text: string) => Buffer.from(text).toString('base64')
const photo = (id: number, text: string) => ({ folder: 'photos' as const, id, base64: base64(text), mimeType: 'image/jpeg' })

function fresh() {
  const root = mkdtempSync(join(tmpdir(), 'pictures-'))
  return { root, store: nodeStore(root) }
}

it('names files after the picture type', () => {
  expect(extensionFor('image/jpeg')).toBe('jpg')
  expect(extensionFor('image/png')).toBe('png')
  expect(extensionFor('image/webp')).toBe('webp')
  expect(extensionFor('image/heic')).toBe('heic')
  expect(extensionFor('image/x-unknown')).toBe('img')
})

it('stages pictures beside the current ones, holding the decoded bytes', async () => {
  const { root, store } = fresh()
  const names = await stagePictures(store, [
    photo(5, 'five'),
    { folder: 'covers', id: 1, base64: base64('cover'), mimeType: 'image/png' },
  ])
  expect(names.get('photos/5')).toBe('5.jpg')
  expect(names.get('covers/1')).toBe('1.png')
  expect(readFileSync(join(root, 'pictures-incoming/photos/5.jpg'), 'utf8')).toBe('five')
  expect(readFileSync(join(root, 'pictures-incoming/covers/1.png'), 'utf8')).toBe('cover')
  expect(store.exists('pictures')).toBe(false)
})

it('commit replaces the current pictures with the staged ones', async () => {
  const { root, store } = fresh()
  await stagePictures(store, [photo(1, 'old')])
  commitStaged(store)
  await stagePictures(store, [photo(2, 'new')])
  commitStaged(store)
  expect(readdirSync(join(root, 'pictures/photos'))).toEqual(['2.jpg'])
  expect(readdirSync(root)).toEqual(['pictures'])
})

it('commit with nothing staged leaves empty folders, not stale pictures', async () => {
  const { root, store } = fresh()
  await stagePictures(store, [photo(1, 'old')])
  commitStaged(store)
  await stagePictures(store, [])
  commitStaged(store)
  expect(readdirSync(join(root, 'pictures/photos'))).toEqual([])
})

it('commit changes nothing when nothing is staged', async () => {
  const { root, store } = fresh()
  await stagePictures(store, [photo(1, 'current')])
  commitStaged(store)
  commitStaged(store)
  expect(readdirSync(join(root, 'pictures/photos'))).toEqual(['1.jpg'])
})

it('commit finishes a swap that stopped between its two renames', async () => {
  const { root, store } = fresh()
  await stagePictures(store, [photo(1, 'old')])
  commitStaged(store)
  await stagePictures(store, [photo(2, 'new')])
  // The app died here: the old set was moved aside, the new one not yet put in place.
  store.renameFolder('pictures', 'pictures-outgoing')
  commitStaged(store)
  expect(readdirSync(join(root, 'pictures/photos'))).toEqual(['2.jpg'])
  expect(readdirSync(root)).toEqual(['pictures'])
})

it('discard drops the staged pictures and leaves the current ones untouched', async () => {
  const { root, store } = fresh()
  await stagePictures(store, [photo(1, 'current')])
  commitStaged(store)
  await stagePictures(store, [photo(2, 'never arrives')])
  discardStaged(store)
  expect(readdirSync(join(root, 'pictures/photos'))).toEqual(['1.jpg'])
  expect(store.exists('pictures-incoming')).toBe(false)
})

it('staging again starts clean after an import that died halfway', async () => {
  const { root, store } = fresh()
  await stagePictures(store, [photo(9, 'left over')])
  await stagePictures(store, [photo(2, 'fresh')])
  expect(readdirSync(join(root, 'pictures-incoming/photos'))).toEqual(['2.jpg'])
})

it('gives the address of a current picture', () => {
  const { store } = fresh()
  expect(pictureUri(store, 'photos', '5.jpg')).toBe(store.uri('pictures/photos/5.jpg'))
})
