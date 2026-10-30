# Stranger basics: in-app browsers, rules, no reminders

Date: 2026-10-30 · Status: **built**, agreed with the owner on 2026-10-30. Step 3 of the MVP order from the ship review.

## Why

Three things stop a stranger with nobody to ask:

- A link opened from TikTok or Instagram runs inside that app's own browser. It has no Add to Home Screen, so the install steps can't work. The way out says "your data stays here", which isn't safe there.
- The rules appear only in onboarding. On Day 40, Settings says only that the challenge is locked. Nobody can check what a missed day costs, or that logging stays open until noon.
- The app sends no reminders and never says so. A stranger can expect one, and lose a Hard attempt without a warning.

## What it does

### 1. In-app browsers

When the page opens inside a known app (TikTok, Instagram, Facebook, Snapchat, LinkedIn, Pinterest, X), the install screen is replaced:

> **Open this in Safari**
> You're inside another app. It can't install 75 Hard, and your days could disappear.
>
> 1. Tap **Copy link**.
> 2. Open **Safari** and paste it in the address bar.
>
> [Copy link]
> Or look for "Open in browser" in this app's menu.
>
> Continue here anyway (your days could be lost)

On Android it says Chrome instead of Safari. "Copy link" changes to "Link copied". "Continue here anyway" is remembered, like the skip on the install screen.

This screen also shows on Android, where the install screen doesn't appear today.

The Safari path gets an honest skip line too: "Continue in Safari (Safari can clear your data if you stop opening it)".

### 2. Rules in Settings

A new **Rules** row sits in the Challenge group and opens its own page, for the attempt you're on:

- **Every day:** the five daily rules, the same lines as the deal.
- **Missing a day:** the same stakes line as the deal.
- **When a day ends:** "Every task is due by midnight. Forgot to log? Yesterday stays open until noon."
- **Reminders:** the line below.

It reads the same text as the deal, so the two can't disagree.

### 3. No reminders

One line on the deal, after the stakes, and on the Rules page:

> No reminders. The app can't send notifications, so opening it every day is on you.

## Choices

- **Copy link, not a one-tap jump.** iPhone apps can't push a page out to Safari. Android has a trick for it, but Android is second priority here.
- **A known list of apps, read from the browser's user agent.** A new app won't be caught until it's added. If the check misses one, the app works as it does today.
- **"75 Hard" stays in the copy.** The rename is step 4.

## Left out

- The install screen on desktop Chrome, and "Continue in Safari" for Chrome on iPhone. Both wait until after launch.
- A help page or FAQ beyond the Rules page.
