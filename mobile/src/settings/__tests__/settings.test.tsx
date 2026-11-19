// The Settings tab as the phone shows it: the cases of the plan's Review Focus 1 to 3
// (docs/superpowers/plans/2026-11-19-v4-part-8-settings.md), from the web's Settings tests.
import { addDaysISO, formatDisplayDate } from '@logic/dates'
import { SETTING_KEYS } from '@logic/settingKeys'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AccessibilityInfo, Alert } from 'react-native'
import { addPerfectDays, freshDatabase } from '../../db/__tests__/fixtures'
import { transaction } from '../../db/open'
import { badgeRepo } from '../../db/repositories/badgeRepo'
import { bookRepo } from '../../db/repositories/bookRepo'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import { insertRow } from '../../db/table'
import { nodeStore } from '../../files/__tests__/nodeStore'
import { picturePath } from '../../files/pictures'
import { useGate } from '../../hooks/useChallengeGate'
import { entryOf, Providers, startAttempt, TODAY } from '../../today/__tests__/support'
import { SettingsScreen } from '../SettingsScreen'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('expo-audio', () => ({ useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn(async () => {}) }), setAudioModeAsync: jest.fn(async () => {}) }))
jest.mock('expo-local-authentication', () => ({ hasHardwareAsync: jest.fn(async () => false), isEnrolledAsync: jest.fn(async () => false) }))
// The phone's own pickers are native views: a plain view stands in, its onValueChange called by the tests.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return <View {...props} />
  },
}))
// The pictures go to a folder on this computer.
jest.mock('../../files/store', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs')
  const os = jest.requireActual<typeof import('node:os')>('node:os')
  const path = jest.requireActual<typeof import('node:path')>('node:path')
  const { nodeStore } = jest.requireActual<typeof import('../../files/__tests__/nodeStore')>('../../files/__tests__/nodeStore')
  return { expoStore: nodeStore(fs.mkdtempSync(path.join(os.tmpdir(), 'settings-'))) }
})

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  await freshDatabase()
})
afterEach(() => jest.restoreAllMocks())

function Tab({ focused = true }: { focused?: boolean }) {
  const gate = useGate()
  return gate ? <SettingsScreen gate={gate} focused={focused} /> : null
}

const show = () => render(<Tab />, { wrapper: Providers })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const press = async (name: string | RegExp) => fireEvent.press(await screen.findByRole('button', { name }))
const open = async (row: string) => press(new RegExp(`^${row}(,|$)`))

describe('the list', () => {
  it('groups the rows as iPhone Settings, each with its value', async () => {
    await startAttempt(3)
    await show()
    expect(await screen.findByRole('button', { name: 'Profile, Daniel' })).toBeOnTheScreen()
    for (const group of ['YOU', 'CHALLENGE', 'APP', 'PRIVACY & DATA', 'DANGER ZONE']) expect(screen.getByText(group)).toBeOnTheScreen()
    expect(button('Challenge, 75 Hard')).toBeOnTheScreen()
    expect(await screen.findByRole('button', { name: 'Appearance, System' })).toBeOnTheScreen()
    expect(button('Sound, On')).toBeOnTheScreen()
    expect(button('Companion, Bedtime 23:00')).toBeOnTheScreen()
    expect(await screen.findByRole('button', { name: 'App lock, Off' })).toBeOnTheScreen()
    // No "Install the app": the App Store installs it.
    expect(screen.queryByText('Install the app')).toBeNull()
    // The book count shows once there is a book.
    expect(button('Books')).toBeOnTheScreen()
    await bookRepo.add({ title: 'Dune', totalPages: 400, currentPage: 0 })
    expect(await screen.findByRole('button', { name: 'Books, 1' })).toBeOnTheScreen()
  })

  it('opens a page from its row, goes back with "Settings", and shows the list again after leaving the tab', async () => {
    await startAttempt(3)
    const view = await show()
    await open('Rules')
    expect(await screen.findByText('Every day')).toBeOnTheScreen()
    expect(screen.getByText('Missing a day')).toBeOnTheScreen()
    expect(screen.queryByText('YOU')).toBeNull()
    await press('Settings')
    expect(await screen.findByText('YOU')).toBeOnTheScreen()

    await open('Rules')
    await screen.findByText('Every day')
    await view.rerender(<Tab focused={false} />)
    await view.rerender(<Tab focused />)
    expect(await screen.findByText('YOU')).toBeOnTheScreen()
  })

  it('offers giving up only while it is allowed, and says so in the footer', async () => {
    await startAttempt(0)
    const view = await show()
    expect(await screen.findByText('Resetting erases every attempt, photo and badge.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Give up this challenge' })).toBeNull()
    await view.unmount()

    await freshDatabase()
    await startAttempt(1)
    await show()
    expect(await screen.findByRole('button', { name: 'Give up this challenge' })).toBeOnTheScreen()
    expect(screen.getByText('Giving up stops this attempt for good; it stays in your history. Resetting erases every attempt, photo and badge.')).toBeOnTheScreen()
  })

  it('erases everything after asking, in a sheet', async () => {
    await startAttempt(3)
    await show()
    await press('Reset everything')
    expect(await screen.findByRole('header', { name: 'Erase everything?' })).toBeOnTheScreen()
    await press('Cancel')
    expect(await challengeRepo.getAll()).toHaveLength(1)

    await press('Reset everything')
    await press('Erase everything')
    await waitFor(async () => expect(await challengeRepo.getAll()).toHaveLength(0))
    expect(await profileRepo.get()).toBeUndefined()
  })

  it('keeps the developer seeds on their own page, each asking first', async () => {
    await startAttempt(3)
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    await show()
    await open('Seeds and checks')
    await press('Seed Day 12')
    expect(alert).toHaveBeenCalledWith('Erase everything?', 'This replaces all data on this phone with a test attempt.', expect.any(Array))
  })
})

describe('the simple pages', () => {
  it('saves the profile, only when it changed and is valid', async () => {
    await startAttempt(3)
    await show()
    await open('Profile')
    const save = () => button('Save')
    expect(save()).toBeDisabled()
    await fireEvent.changeText(screen.getByLabelText('Name'), '  ')
    expect(save()).toBeDisabled()
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Dan')
    await fireEvent.changeText(screen.getByLabelText("Why you're doing this"), 'For me')
    await press('Save')
    expect(await screen.findByText('Saved.')).toBeOnTheScreen()
    expect(await profileRepo.get()).toMatchObject({ name: 'Dan', why: 'For me' })
  })

  it('picks the theme, turns the sound off and keeps the bedtime in range', async () => {
    await startAttempt(3)
    await show()
    await open('Appearance')
    await fireEvent.press(await screen.findByRole('radio', { name: 'Dark' }))
    await waitFor(async () => expect(await settingsRepo.get(SETTING_KEYS.theme, 'system')).toBe('dark'))
    expect(await screen.findByRole('radio', { name: 'Dark' })).toBeChecked()
    await press('Settings')

    await open('Sound')
    await fireEvent.press(await screen.findByRole('switch', { name: 'Sound effects' }))
    await waitFor(async () => expect(await settingsRepo.get(SETTING_KEYS.soundEnabled, true)).toBe(false))
    await press('Settings')
    expect(await screen.findByRole('button', { name: 'Sound, Off' })).toBeOnTheScreen()

    await open('Companion')
    const pick = (hours: number, minutes: number) => {
      const at = new Date()
      at.setHours(hours, minutes)
      return fireEvent(screen.getByTestId('time-field'), 'valueChange', {}, at)
    }
    await pick(3, 0)
    expect(await screen.findByText('Pick a time between 18:00 and 23:59.')).toBeOnTheScreen()
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, 'none')).toBe('none')
    await pick(22, 30)
    await waitFor(async () => expect(await settingsRepo.get(SETTING_KEYS.bedtime, 'none')).toBe('22:30'))
    expect(screen.queryByText('Pick a time between 18:00 and 23:59.')).toBeNull()
  })
})

describe('Challenge', () => {
  it('switches the challenge at once without logs, asks first with them, and locks after Day 1', async () => {
    const id = await startAttempt(1)
    const view = await show()
    await open('Challenge')
    expect(await screen.findByText('Day 1 is today — ' + formatDisplayDate(TODAY) + '.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: /^75 Soft/ }))
    await waitFor(async () => expect((await challengeRepo.getById(id))?.variant).toBe('soft'))

    const entry = await entryOf(id)
    await dayEntryRepo.adjustWater(entry.id, 500)
    await fireEvent.press(await screen.findByRole('radio', { name: /^75 Hard/ }))
    expect(await screen.findByRole('header', { name: 'Switch to 75 Hard?' })).toBeOnTheScreen()
    await press('Switch')
    await waitFor(async () => expect((await challengeRepo.getById(id))?.variant).toBe('hard'))
    await view.unmount()

    await freshDatabase()
    await startAttempt(2)
    await show()
    await open('Challenge')
    expect(await screen.findByText('🔒 75 Hard — locked for this attempt.')).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: /^75 Soft/ })).toBeNull()
  })

  it('moves the start date, asking first when Day 1 has logs', async () => {
    const id = await startAttempt(1)
    const entry = await entryOf(id)
    await dayEntryRepo.adjustWater(entry.id, 500)
    await show()
    await open('Challenge')
    const tomorrow = addDaysISO(TODAY, 1)
    const [y, m, d] = tomorrow.split('-').map(Number)
    await fireEvent(await screen.findByLabelText('Start date'), 'valueChange', {}, new Date(y, m - 1, d))
    await press('Save')
    expect(await screen.findByRole('header', { name: 'Move the start date?' })).toBeOnTheScreen()
    await press('Clear & move')
    await waitFor(async () => expect((await challengeRepo.getById(id))?.startDate).toBe(tomorrow))
    expect(await dayEntryRepo.getAllForChallenge(id)).toHaveLength(0)
  })
})

describe('challengeRepo.changeStartDate', () => {
  it("clears the old days' logs, photos (rows and files) and badges, and shifts the social nights", async () => {
    const store = nodeStore(mkdtempSync(join(tmpdir(), 'move-')))
    const id = await startAttempt(1, 'medium')
    await challengeRepo.setSocialDay(id, 5, true, TODAY)
    const entry = await entryOf(id)
    const photoId = await transaction((db) => insertRow(db, 'photos', { date: TODAY, file: 'p.jpg', mimeType: 'image/jpeg' }))
    await store.writeBase64(picturePath('photos', 'p.jpg'), 'AQ==')
    expect(store.exists(picturePath('photos', 'p.jpg'))).toBe(true)
    await dayEntryRepo.update(entry.id, { photoId })
    await badgeRepo.unlockMissing(id, ['first-workout'])

    const tomorrow = addDaysISO(TODAY, 1)
    expect(await challengeRepo.changeStartDate(id, tomorrow, TODAY, store)).toEqual({ ok: true })
    const challenge = await challengeRepo.getById(id)
    expect(challenge).toMatchObject({ startDate: tomorrow, socialDays: [4] })
    expect(await dayEntryRepo.getAllForChallenge(id)).toHaveLength(0)
    expect(await badgeRepo.getForChallenge(id)).toHaveLength(0)
    expect(await transaction((db) => db.getAllAsync('SELECT * FROM photos'))).toHaveLength(0)
    expect(store.exists(picturePath('photos', 'p.jpg'))).toBe(false)
  })

  it('refuses a date in the past, and any move after Day 1', async () => {
    const id = await startAttempt(1)
    expect(await challengeRepo.changeStartDate(id, addDaysISO(TODAY, -1), TODAY, nodeStore(mkdtempSync(join(tmpdir(), 'move-'))))).toEqual({ ok: false, reason: 'past' })
    await freshDatabase()
    const later = await startAttempt(2)
    expect(await challengeRepo.changeStartDate(later, addDaysISO(TODAY, 1), TODAY, nodeStore(mkdtempSync(join(tmpdir(), 'move-'))))).toEqual({ ok: false, reason: 'locked' })
  })
})

describe('Books', () => {
  it('adds, edits and deletes a book, the form and the question in one sheet', async () => {
    await startAttempt(3)
    await show()
    await open('Books')
    expect(await screen.findByText('No books added yet.')).toBeOnTheScreen()
    await press('+ Add book')
    expect(await screen.findByRole('header', { name: 'Add a book' })).toBeOnTheScreen()
    await press('Save')
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Dune')
    await fireEvent.changeText(screen.getByLabelText('Total pages'), '400')
    await fireEvent.changeText(screen.getByLabelText('On page'), '12')
    await press('Save')
    expect(await screen.findByText('12 / 400 pages')).toBeOnTheScreen()

    await press('Edit Dune')
    expect(await screen.findByRole('header', { name: 'Edit book' })).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('On page'), '400')
    await press('Save')
    expect(await screen.findByText('400 / 400 pages')).toBeOnTheScreen()
    expect(screen.getByText('Dune ✓')).toBeOnTheScreen()

    const [book] = await bookRepo.getAll()
    await settingsRepo.set(SETTING_KEYS.currentBookId, book.id)
    await press('Delete Dune')
    expect(await screen.findByRole('header', { name: 'Delete this book?' })).toBeOnTheScreen()
    await press('Delete')
    expect(await screen.findByText('No books added yet.')).toBeOnTheScreen()
    expect(await settingsRepo.get(SETTING_KEYS.currentBookId, 'unset')).toBeNull()
  })
})

describe('Attempt history', () => {
  it('lists the attempts, and opens one as a page with its days and photos', async () => {
    const id = await startAttempt(3)
    const start = addDaysISO(TODAY, -2)
    await addPerfectDays(id, start, 1, 2)
    await show()
    await open('Attempt history')
    await press(/^Attempt #1 · On Day 3/)
    expect(await screen.findByRole('header', { name: 'Attempt #1' })).toBeOnTheScreen()
    expect(screen.getByText('On Day 3 · 2 perfect days')).toBeOnTheScreen()
    expect(screen.getByText(/· all done$/)).toBeOnTheScreen()
    // The seeded days' photo rows point at files the store doesn't have: still listed.
    expect(await screen.findByRole('button', { name: 'Day 2 progress' })).toBeOnTheScreen()
    await press('Day 2 progress')
    expect(await screen.findByRole('button', { name: '← Older' })).toBeOnTheScreen()
    await act(async () => {})
    await press('Attempt history')
    expect(await screen.findByText('Tap an attempt to see its days and photos.')).toBeOnTheScreen()
    expect(within(screen.getByRole('button', { name: /^Attempt #1/ })).getByText('Active')).toBeOnTheScreen()
  })
})
