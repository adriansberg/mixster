# Technology Stack

**Analysis Date:** 2026-05-18

## Languages

**Primary:**
- TypeScript ^5.9.3 - All server and client logic
- Svelte ^5.41.0 - UI components (`.svelte` files)

**Secondary:**
- CSS (Tailwind) - Styling via utility classes

## Runtime

**Environment:**
- Node.js 22 (specified in `svelte.config.js` adapter runtime: `nodejs22.x`, Dockerfile base: `node:22-alpine`)

**Package Manager:**
- pnpm (lockfile: `pnpm-lock.yaml` present)

## Frameworks

**Core:**
- SvelteKit ^2.47.1 - Full-stack framework; routing, SSR, server endpoints
- Svelte 5 ^5.41.0 - Component model (uses runes)

**Build/Dev:**
- Vite ^7.1.10 - Dev server and bundler; config at `vite.config.ts`
- `@sveltejs/vite-plugin-svelte` ^6.2.1 - Svelte integration for Vite
- `@sveltejs/adapter-vercel` ^6.1.2 - Production adapter (active in `svelte.config.js`)
- `@sveltejs/adapter-auto` ^7.0.0 - Installed but not active
- PostCSS ^8.5.6 - CSS pipeline; config at `postcss.config.js`
- Autoprefixer ^10.4.22 - PostCSS plugin

**PWA:**
- `@vite-pwa/sveltekit` ^1.0.1 - PWA manifest + service worker (configured in `vite.config.ts`)
- `vite-plugin-pwa` ^1.1.0 - Underlying PWA plugin
- `workbox-window` ^7.4.0 - Service worker runtime

**Testing:**
- Not detected

## Key Dependencies

**Database ORM:**
- `drizzle-orm` ^0.44.7 - Type-safe ORM; schema at `src/lib/server/db/schema.ts`
- `drizzle-kit` ^0.31.7 - Migrations/studio CLI; config at `drizzle.config.ts`
- `postgres` ^3.4.7 - PostgreSQL client used by drizzle (`postgres-js` driver)

**Auth / Crypto:**
- `arctic` ^3.7.0 - OAuth 2.0 / PKCE flows (Spotify provider)
- `@oslojs/crypto` ^1.0.1 - SHA-256 for session token hashing
- `@oslojs/encoding` ^1.1.0 - Base32/hex encoding for session tokens
- `@node-rs/argon2` ^2.0.2 - Password hashing (argon2, native addon)
- `@node-rs/bcrypt` ^1.10.7 - Password hashing (bcrypt, native addon)
- `nanoid` ^5.1.6 - ID generation for DB primary keys

**Email:**
- `resend` ^6.5.2 - Transactional email SDK; used in `src/lib/server/email.ts`

**Validation:**
- `zod` ^4.1.12 - Schema validation; env vars validated at `src/lib/server/env.ts`

**UI Components:**
- `bits-ui` ^2.14.4 - Headless component primitives
- `lucide-svelte` ^0.554.0 - Icon library
- `tailwindcss` ^4.1.17 - Utility CSS framework
- `tailwindcss-animate` ^1.0.7 - Animation utilities
- `@tailwindcss/typography` ^0.5.19 - Prose styling
- `tailwind-merge` ^3.4.0 - Conditional class merging
- `tailwind-variants` ^3.1.1 - Variant-based class composition
- `clsx` ^2.1.1 - Classname utility

**Linting / Formatting:**
- `eslint` ^9.39.1 - Config at `eslint.config.js`
- `@typescript-eslint/parser` ^8.47.0 + `@typescript-eslint/eslint-plugin` ^8.47.0
- `eslint-plugin-svelte` ^3.13.0 + `svelte-eslint-parser` ^1.4.0
- `eslint-config-prettier` ^10.1.8
- `prettier` ^3.6.2 - Config at `.prettierrc`
- `prettier-plugin-svelte` ^3.4.0

## Configuration

**Environment:**
- Validated at startup via Zod in `src/lib/server/env.ts`
- SvelteKit `$env/dynamic/private` + `$env/dynamic/public` used for access
- Required vars: `DATABASE_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `PUBLIC_APP_URL`
- Optional vars: `NODE_ENV`, `RESEND_API_KEY`, `EMAIL_FROM`

**Build:**
- `tsconfig.json` + `.svelte-kit/tsconfig.json`
- `vite.config.ts`
- `svelte.config.js`
- `drizzle.config.ts`

## Platform Requirements

**Development:**
- Node.js 22, pnpm
- PostgreSQL instance (local or remote)
- Docker Compose available: `docker-compose.yml`

**Production:**
- Vercel (primary target — `vercel.json`, `@sveltejs/adapter-vercel`, region: `iad1`)
- Docker also supported — multi-stage `Dockerfile` present, exposes port 3000

---

*Stack analysis: 2026-05-18*
