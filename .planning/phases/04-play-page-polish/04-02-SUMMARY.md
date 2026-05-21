---
plan: 04-02
phase: 04-play-page-polish
status: complete
completed_at: 2026-05-21
commits:
  - a658fb1
requirements_addressed: [UI-01, UI-02, UI-03, UI-04, API-04]
---

# Plan 04-02 Summary — Play Page UI Polish

## What was built

Single-file change to `src/routes/play/+page.svelte`.

### State additions
- `requiresReauth = $state(false)` — drives the orange re-auth banner
- `rateLimited = $state(false)` — drives the yellow 429 banner

### Alert/goto replacement (UI-01, UI-02)
All three `alert() + goto('/auth/login/spotify')` sites replaced with `requiresReauth = true; return;`:
- `onMount` device fetch (auth expiry on page load)
- `getNextSong()` !ok branch (auth expiry mid-game)
- `playSong()` !ok branch (auth expiry on playback)

One `goto('/auth/login/spotify')` remains — the user-click CTA in the re-auth banner.

### 429 handling (API-04 client)
`getNextSong()` now checks `response.status === 429` before the generic `!response.ok` branch — sets `rateLimited = true; return;`. The PRØV IGJEN button clears the flag and retries.

### D-01 clearing
`getNextSong()` entry now clears `requiresReauth`, `rateLimited`, and `errorMessage` before each attempt.

### D-02 button disable
`disabled={loading || requiresReauth}` on NESTE SANG and START FØRSTE SANG.

### console.log removal (UI-03)
`console.log('data', data)` removed from onMount.

### Template priority chain
```
{#if requiresReauth}         → orange banner + "Logg inn igjen"
{:else if rateLimited}       → yellow banner + "PRØV IGJEN"
{:else if showDeviceSelector} → device picker
{:else if errorMessage}      → destructive banner
{:else if !currentTrack}     → "Klar til å spille!" + START FØRSTE SANG
{/if}
```

### TV layout (UI-04)
- VIS SANG + NESTE SANG: `text-lg md:text-xl px-10 py-6` (was `text-base md:text-lg px-8 py-6`)
- Desktop songs counter: `text-base` (was `text-sm`)
- `.perspective-card` max-width: `480px` (was `400px`)

### Norwegian copy
All English error strings replaced with Norwegian per UI-SPEC copywriting contract.

## Verification

- `grep -c "alert(" src/routes/play/+page.svelte` → 0 ✓
- `grep -c "console.log('data'" src/routes/play/+page.svelte` → 0 ✓
- `npx tsc --noEmit` → exit 0 ✓
- `npx prettier --check src/routes/play/+page.svelte` → exit 0 ✓
- `npx eslint src/routes/play/+page.svelte` → exit 0 ✓
