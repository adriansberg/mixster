# Requirements: Mixster

**Defined:** 2026-05-18
**Core Value:** Any party with a Spotify account can play a Hitster-style game with their own playlists — no physical cards, no preset content.

## v1 Requirements

### Spotify API

- [ ] **API-01**: Random song selection works for default HITSTER playlists (third-party owned) using `/items` endpoint with random offset strategy
- [ ] **API-02**: Playlist metadata (name, track count) resolves from Spotify URL/URI using `?fields=id,name,items.total`
- [ ] **API-03**: Token refresh buffer widened to 5 min to prevent mid-game re-auth
- [ ] **API-04**: 429 rate limit responses handled gracefully — no silent retry storm

### Security & Cleanup

- [ ] **SEC-01**: Token endpoint (`/api/spotify/token`) removed — raw Spotify token no longer exposed to browser
- [ ] **SEC-02**: Dead IDOR-vulnerable playlist DB routes removed (`/playlists` DELETE, `/playlist/add`, `/playlist/toggle`)
- [ ] **SEC-03**: Duplicate player start route removed (`/player/start`)
- [ ] **SEC-04**: Dead client-side service removed (`SpotifyPlayerService`, `spotify-player.ts`, `spotify-player.d.ts`)
- [ ] **SEC-05**: Dead email scaffolding removed (`email.ts`, unused `RESEND_API_KEY`/`EMAIL_FROM` env vars)
- [ ] **SEC-06**: `userPlaylists` DB table dropped — migration generated and applied

### Playlist Management

- [ ] **PLAY-01**: User can add a custom playlist by pasting a Spotify URL or URI
- [ ] **PLAY-02**: Added playlist shows resolved name and track count (fetched from Spotify)
- [ ] **PLAY-03**: User can toggle any playlist (default or custom) on/off; state persists across page reloads
- [ ] **PLAY-04**: User can remove a custom playlist
- [ ] **PLAY-05**: Playlist state stored in consolidated localStorage schema (`mixster_playlists`, versioned, Zod-validated)
- [ ] **PLAY-06**: Random song selection only draws from enabled playlists
- [ ] **PLAY-07**: URI validation rejects invalid input early (400) — no silent 10-attempt failure

### Session Management

- [ ] **SESS-01**: User can clear play history (dedup reset) from the play or setup page
- [ ] **SESS-02**: Clearing history retains all playlist selections and enabled/disabled state
- [ ] **SESS-03**: History clear requires inline confirmation (no `window.confirm()`)
- [ ] **SESS-04**: Songs-played counter shown during game; resets when history is cleared

### Play Page

- [ ] **UI-01**: All `alert()` calls replaced with inline error states (3 instances in `play/+page.svelte`)
- [ ] **UI-02**: Re-auth prompt shown as inline banner — no hard redirect without user action
- [ ] **UI-03**: `console.log('data', data)` removed from `play/+page.svelte`
- [ ] **UI-04**: Play page layout readable on large screen (TV/monitor) at party distance

### Auth

- [ ] **AUTH-01**: Uncommitted re-auth changes committed (SpotifyAuthError, deleteSpotifyTokens, reauth endpoint, spotify-player.d.ts)

## v2 Requirements

### Resilience

- **RES-01**: Stale device list auto-refreshed on play failure (404 device not found)
- **RES-02**: Private/inaccessible playlist (403) shows warning on add, skipped during song selection
- **RES-03**: Token refresh singleton — prevents concurrent refresh race condition

### UX Polish

- **UX-01**: Album art shown on flip card
- **UX-02**: PWA manifest configured for fullscreen landscape (TV install)
- **UX-03**: "Refresh devices" button in device selector
- **UX-04**: Playlist 403 warning shown at add-time ("playlist is private or inaccessible")

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-player scoring / leaderboards | "Just the jukebox" — social game, no tracking |
| Player phones / multi-device | Single-screen experience |
| Decade/era filtering | Playlist selection is the filter |
| Email/password auth | Spotify-only OAuth |
| Playlist search by name | Paste URL/URI is sufficient |
| Dark/light theme toggle | Lock dark — party context |
| Multiple simultaneous sessions | Single Spotify account, one party at a time |
| Countdown timers | Adds pressure that doesn't fit the vibe |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 4 | Pending |
| API-04 | Phase 4 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 2 | Pending |
| SEC-04 | Phase 2 | Pending |
| SEC-05 | Phase 2 | Pending |
| SEC-06 | Phase 2 | Pending |
| PLAY-01 | Phase 3 | Pending |
| PLAY-02 | Phase 3 | Pending |
| PLAY-03 | Phase 3 | Pending |
| PLAY-04 | Phase 3 | Pending |
| PLAY-05 | Phase 3 | Pending |
| PLAY-06 | Phase 3 | Pending |
| PLAY-07 | Phase 4 | Pending |
| SESS-01 | Phase 3 | Pending |
| SESS-02 | Phase 3 | Pending |
| SESS-03 | Phase 3 | Pending |
| SESS-04 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| AUTH-01 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-18*
