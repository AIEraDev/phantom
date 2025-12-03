# Coding Standards

## TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Always define return types for functions
- Use `unknown` over `any` when type is uncertain

## Backend Conventions

- Controllers handle HTTP/WebSocket requests
- Services contain business logic
- Use dependency injection patterns
- All database queries go through repositories
- Socket events follow `action:resource` naming (e.g., `battle:join`)

## Frontend Conventions

- Use React Server Components where possible
- Client components marked with `'use client'`
- Hooks for shared stateful logic
- TailwindCSS for styling, no inline styles
- Monaco Editor for code input areas

## File Naming

- Components: PascalCase (`BattleArena.tsx`)
- Utilities: camelCase (`formatTime.ts`)
- Constants: SCREAMING_SNAKE_CASE
- Test files: `*.test.ts` or `*.spec.ts`

## Git Workflow

- Feature branches from `main`
- Descriptive commit messages
- PR reviews before merge
