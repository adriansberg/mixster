# Feature Landscape

**Domain:** Spotify party jukebox / year-guessing game (Hitster-style)
**Researched:** 2026-05-18
**Context:** 3-8 players, one screen (laptop/TV), host-operated, no player phones

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Playlist toggle on/off | Players always want to include/exclude some playlists | Low | Toggle persists in localStorage; already scaffolded but UI incomplete |
| Track count per playlist | Gives host signal about pool size before starting | Low | Fetched from Spotify, cache 24h — already exists for defaults, needs custom playlists |
| Total song count summary | "1,200 songs" builds confidence before hitting Start | Low | Already partially implemented as derived state |
| Add custom playlist by URL | Core differentiator from physical Hitster | Low-Med | API validate endpoint exists; UI exists but needs polish |
| Remove custom playlist | Guests add wrong playlists, need immediate undo | Low | Exists |
| Clear play history | Essential when replaying or resetting session | Low | Exists but uses `alert()` — needs proper confirm dialog |
| Flip card reveal with year prominent | The game's central moment; year must be unmissable | Low | Exists; year is 5xl/6xl in gradient badge — good |
| Play/pause during guessing | Groups debate while music plays; pause to focus | Low | Exists |
| Next song after reveal | Flow must be immediate and obvious | Low | "NESTE SANG" button exists post-reveal |
| Device selector (Spotify) | Multiple devices in a party room are common | Low | Exists; auto-selects active device |
| Re-auth recovery | Tokens expire mid-session at parties | Low | Redirects to login; currently uses alert() — needs graceful recovery |

---

## Differentiators

Features that set this apart. Not expected, but create delight.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Songs-played counter visible during game | Pacing signal — "we've done 12 songs" tells host when to wrap up | Low | Simple $state counter incremented on each getNextSong; display in header |
| Confirm before clearing history | Prevents accidental history wipe mid-game | Low | Replace alert() with inline confirm or modal |
| Playlist enabled/disabled toggle (not just add/remove) | Lets host hot-swap playlists mid-game without losing custom ones | Med | localStorage toggle; custom playlists need `enabled` flag added to schema |
| Reveal auto-pauses playback | Stops music exactly when card flips — heightens reveal moment | Low | Already implemented — keep this, it is the right call |
| Album art on revealed card | Visual memory anchor — players remember "that album cover" | Low | Already shown; ensure it loads before flip or show skeleton |
| Big year number with high contrast | Year is the answer — must read from 3m across a dark room | Low | Already 5xl/6xl in gradient pill; verify readable on dark background at distance |
| "Klar til å spille" idle state with large START button | Clear affordance for the "begin" moment | Low | Exists — good party UX |
| Norwegian copy | Localized for intended user base | Low | Already Norwegian — keep it |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Per-player scoring or leaderboards | Kills the social dynamic; turns debate into individual competition; explicitly out of scope | Stay scoreless; the fun is collective |
| Player phone controllers (Jackbox-style) | Requires network coordination, increases setup friction, defeats "one screen" simplicity | Host operates all controls on the shared screen |
| Countdown timer during guessing | Adds pressure that breaks natural conversation rhythm; party groups need time to debate | Let the music fill the time; host controls pacing via play/pause |
| Decade/era filter | Orthogonal to playlist-as-filter model; adds settings complexity | Use multiple playlists instead |
| Song search or browse history | Replay value comes from randomness; browsing undermines that | Clear history is enough |
| Session recap / "Year in Review" summary screen | Disproportionate complexity for no-scoring game; nobody needs stats after a party | Songs-played counter is sufficient signal |
| Liked/bookmarked songs during play | Adds a parallel tracking system with unclear payoff for a no-scoring game | Not worth the UI clutter |
| Playlist search by name | Paste URL/URI is fast enough; search requires Spotify API scope increase | Current pattern is fine |
| Dark/light theme toggle | Party setting is always dark room + TV; dark theme wins unconditionally | Lock to dark theme |
| Email/password auth | Out of scope; Spotify OAuth only | Already decided |
| Multiple simultaneous sessions | localStorage keyed to one session; party is one device | Not needed |

---

## Feature Dependencies

```
Custom playlist toggle (enabled flag) → songs/random must filter by enabled:true
Track count on custom playlists → validate endpoint must return trackCount (already does)
Songs-played counter → increment in getNextSong() after successful track fetch
Confirm dialog for clear history → replace alert() with inline state (showConfirm: bool)
```

---

## Party-Context UX Priorities

Patterns specific to 3-8 people around one screen in a dim room:

**Legibility at distance (2-4m from laptop/TV):**
- Year: min 4xl (current 5xl/6xl — correct)
- Artist name: min 2xl
- Song title: min 2xl
- Button labels: min text-lg, fat padding
- Avoid muted-foreground for critical info — muted fails at distance

**Touch target sizes (host operating under social pressure):**
- Primary actions (VIS SANG, NESTE SANG): current px-8 py-6 — good
- Secondary actions (play/pause): w-16 h-16 rounded-full — good
- Destructive actions (TØM HISTORIKK): keep small/secondary — correct

**Cognitive load during party:**
- One primary action visible at a time (VIS SANG vs NESTE SANG alternation — already correct)
- Error messages must not block game flow; use non-modal inline errors
- Device selector is a setup step — hide after selection, not persistent UI

**State clarity:**
- "Klar til å spille" empty state is clear — good
- Post-reveal state: NESTE SANG is the only forward action — correct
- Loading state: LASTER... text is sufficient — no spinner needed

---

## MVP for This Milestone

Already-built core is solid. Priority order for polish:

1. Playlist toggle (enabled/disabled) with `enabled` flag on custom playlists
2. Songs-played counter in header during game
3. Replace all `alert()` / `confirm()` calls with inline UI (clear history confirm, error recovery)
4. Graceful Spotify re-auth (modal or inline prompt instead of `alert()` + redirect)
5. Custom playlist track count shown in setup (same as defaults — parity)

Defer:
- Album art skeleton/placeholder (nice-to-have, not blocking)
- Any animation work beyond existing flip card
- Setup page redesign if current flow tests well with users

---

## Sources

- Hitster official how-to-play: https://hitstergame.com/en-gb/how-to-play/
- Hitster app App Store: https://apps.apple.com/us/app/hitster/id1621483628
- Jackbox design principles: https://www.builtinchicago.org/articles/jackbox-games-design-party-pack
- TV/big screen UX: https://www.toptal.com/designers/ui/tv-ui-design
- TV typography: https://developer.android.com/design/ui/tv/guides/styles/typography
- QR Music Game reveal mechanics: https://qrmusicgame.com/en
