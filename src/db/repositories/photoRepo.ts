import { db } from '../db'
import type { Photo } from '../types'

export const photoRepo = {
  async save(photo: Omit<Photo, 'id'>): Promise<number> {
    return db.photos.add(photo as Photo)
  },

  async getById(id: number): Promise<Photo | undefined> {
    return db.photos.get(id)
  },

  async getAll(): Promise<Photo[]> {
    return db.photos.orderBy('date').toArray()
  },

  async remove(id: number): Promise<void> {
    await db.photos.delete(id)
  },
}
