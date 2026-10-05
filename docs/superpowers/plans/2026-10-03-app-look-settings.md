# App look, part 5 (Settings): plan

Spec: `docs/superpowers/specs/2026-10-03-app-look-design.md` (Parts 2–5 outline, Settings).

1. **Building blocks** (`SettingsRows.tsx`):
   - `SettingsGroup`: an uppercase title, the rows in one card, and an optional footer note.
   - `SettingsRow`: an icon tile in the world colour, the label, the current value, and a chevron. The red danger variant has no chevron.
   - `SettingsPage`: a back button, the page title in Lilita One, then the controls.
2. **The list:**
   - **You:** Profile (name), Badges
   - **Challenge:** Challenge (variant, while active), Books (count), Attempt history
   - **App:** Appearance (System/Light/Dark), Sound & haptics (On/Off/…), Companion (bedtime), Install (Installed)
   - **Data:** Backup & storage
   - **Danger zone:** Give up and Reset, which open their flows directly, with a footer that explains them
3. **Pages:** each row opens a page holding the existing section component, unchanged apart from emoji-free titles and the hairline border.
4. **New icons:** profile, badge, history, appearance, sound, companion, install, backup, warning.
5. **Tests:** the groups, opening a page and coming back, and the danger zone (now with its footer text). `matchMedia` is stubbed for the install row.
