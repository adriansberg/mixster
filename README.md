# SvelteKit Bootstrap Template

A modern, production-ready SvelteKit template with authentication, database, PWA support, and deployment configurations.

## ✨ Features

- **SvelteKit 5** - Latest version with Svelte Runes ($state, $derived, $effect)
- **TypeScript** - Fully typed with strict mode
- **Authentication** - Email/password signup/login with session management
- **OAuth Ready** - Arctic integration for Google, GitHub, Apple (routes not implemented)
- **Database** - PostgreSQL with Drizzle ORM
- **Session Management** - Custom implementation using Oslo packages
- **Email** - Resend integration with dev console logging
- **Styling** - Tailwind CSS 4.x with OKLCH colors
- **Dark Mode** - Light/dark theme with system detection
- **UI Components** - shadcn-svelte compatible components with bits-ui
- **Code Quality** - Biome for fast linting and formatting
- **PWA** - Progressive Web App support with Vite PWA
- **Docker** - Local development and production containers
- **Deployment** - Vercel adapter configured

## 🚀 Quick Start

### Prerequisites

- Node.js 20 or later
- pnpm 9 or later
- Docker (for local PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Generate auth secret and update .env
openssl rand -base64 32
# Copy the output and set AUTH_SECRET in .env

# Start PostgreSQL database
docker-compose up -d

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

Visit http://localhost:5173 and create an account!

## 📝 Environment Variables

Create a `.env` file with these variables:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bootstrap

# Auth
AUTH_SECRET=your-generated-secret-here
PUBLIC_APP_URL=http://localhost:5173

# Email (Resend)
RESEND_API_KEY=your-key-here # Optional for dev (logs to console)

# OAuth (Optional)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
# APPLE_CLIENT_ID=
# APPLE_CLIENT_SECRET=
```

## 📦 Available Scripts

```bash
# Development
pnpm dev              # Start dev server on http://localhost:5173
pnpm build            # Build for production
pnpm preview          # Preview production build

# Database
pnpm db:generate      # Generate migration files
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes (dev only)
pnpm db:studio        # Open Drizzle Studio

# Code Quality
pnpm lint             # Run Biome linter
pnpm format           # Format code with Biome
pnpm check            # Type check with svelte-check
```

## 🗄️ Database Schema

The bootstrap includes these tables:

- **users** - User accounts with email, password, name, avatar
- **sessions** - User sessions with expiration
- **email_verification_codes** - OTP codes for email verification
- **password_reset_tokens** - Tokens for password reset flow
- **oauth_accounts** - OAuth provider linkage

## 🎨 Theming

The template uses OKLCH colors for consistent appearance across light and dark modes:

- Colors defined in `src/app.css` as CSS variables
- Theme toggle component in `src/lib/components/theme-toggle.svelte`
- Theme store in `src/lib/stores/theme.ts`
- System preference detection on load

To customize colors, edit the CSS variables in `src/app.css`.

## 🔐 Authentication

### Current Implementation

- **Signup** - `/auth/signup` with email/password
- **Login** - `/auth/login` with email/password
- **Logout** - `/auth/logout` POST endpoint
- **Protected Routes** - Dashboard example at `/dashboard`
- **Session Management** - 30-day sessions with 15-day refresh window

### Email Verification

Backend complete, frontend page not implemented. To add:

1. Create `/auth/verify-email/+page.svelte`
2. Display form to enter 6-digit code
3. Submit code to verify endpoint

### Password Reset

Backend tokens complete, frontend pages not implemented. To add:

1. Create `/auth/forgot-password` page
2. Create `/auth/reset-password/[token]` page
3. Implement form submissions

### OAuth

Providers configured in `src/lib/server/auth/providers.ts`, but callback routes not created. To add OAuth:

1. Set environment variables for provider credentials
2. Create `/auth/login/[provider]/+server.ts` for OAuth initiation
3. Create `/auth/callback/[provider]/+server.ts` for OAuth callback
4. Handle account linking/creation

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

Or use Vercel CLI:

```bash
vercel
```

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t my-app .

# Run container
docker run -p 3000:3000 --env-file .env my-app
```

For production, use a managed PostgreSQL service like:

- Neon (recommended for Vercel)
- Supabase
- Railway
- AWS RDS

## 📱 PWA Configuration

PWA is configured but icon files need to be added:

1. Create icons at 192x192 and 512x512
2. Place in `static/` folder
3. Update `vite.config.ts` manifest paths
4. Icons will be cached by service worker

## 🏗️ Tech Stack

| Category         | Technology               |
| ---------------- | ------------------------ |
| Framework        | SvelteKit 5              |
| Language         | TypeScript               |
| Database         | PostgreSQL + Drizzle ORM |
| Auth             | Oslo packages + Arctic   |
| Styling          | Tailwind CSS 4.x         |
| Components       | shadcn-svelte + bits-ui  |
| Email            | Resend                   |
| Linting          | Biome                    |
| PWA              | @vite-pwa/sveltekit      |
| Deployment       | Vercel Adapter           |
| Password Hashing | @node-rs/argon2          |

## 🤝 Contributing

This is a template repository. Fork it and customize for your needs!

## 📄 License

MIT
