# Better-T-Stack Project Rules

This is a sponsorspy project created with Better-T-Stack CLI.

## Project Structure

This is a monorepo with the following structure:

- **`apps/web/`** - Frontend application (TanStack Start)

- **`packages/backend/`** - Convex backend functions

## Available Scripts

- `pnpm run dev` - Start all apps in development mode
- `pnpm run dev:web` - Start only the web app
- `pnpm run build` - Build all apps
- `pnpm run lint` - Lint all packages
- `pnpm run typecheck` - Type check all packages

## Authentication

Authentication is powered by Better Auth:

- Auth configuration is in `packages/auth/src/`
- Web app auth client is in `apps/web/src/lib/auth-client.ts`

## Project Configuration

This project includes a `bts.jsonc` configuration file that stores your Better-T-Stack settings:

- Contains your selected stack configuration (database, ORM, backend, frontend, etc.)
- Used by the CLI to understand your project structure
- Safe to delete if not needed

## Key Points

- This is a Turborepo monorepo using pnpm workspaces
- Each app has its own `package.json` and dependencies
- Run commands from the root to execute across all workspaces
- Run workspace-specific commands with `pnpm run command-name`
- Turborepo handles build caching and parallel execution
