import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'

/** Lets the user choose a backup file (Files, iCloud Drive…). Its text, or null when they cancel. */
export async function pickBackupFile(): Promise<string | null> {
  // Every file type is offered: file providers don't always label a .json export as JSON.
  // What was picked is checked afterwards (readBackupText).
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
  if (result.canceled) return null
  // ponytail: the whole file is read as one string (a backup with 75 photos is 30 to 50 MB).
  // If phones run short of memory, read it in pieces with FileHandle.
  return new File(result.assets[0].uri).text()
}
