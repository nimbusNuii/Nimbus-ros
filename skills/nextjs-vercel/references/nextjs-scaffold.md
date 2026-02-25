# Next.js Scaffold Reference

## Goal
Provide concrete `create-next-app` command variants and the flags to use for common choices.

## Common Commands
Use one of these forms based on the user's package manager:
- `npx create-next-app@latest my-app`
- `pnpm create next-app my-app`
- `yarn create next-app my-app`

## Recommended Prompts to Clarify
- App Router or Pages Router
- TypeScript or JavaScript
- Tailwind or another styling approach
- ESLint on or off
- `src/` directory layout or root
- Import alias (default or custom)

## Notes
- App Router is the default for newer Next.js versions; choose Pages Router only when the user needs it.
- Use consistent package manager commands for install, dev, build, and start.
