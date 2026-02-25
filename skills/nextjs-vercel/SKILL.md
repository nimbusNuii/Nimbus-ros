---
name: nextjs-vercel
description: Create Next.js apps and deploy to Vercel. Use when asked to scaffold a Next.js app, configure App Router or Pages Router, set up environment variables, connect a Git repo, configure Vercel build/output settings, or troubleshoot Vercel build/deploy issues.
---

# Next.js + Vercel

## Overview
Enable a repeatable workflow to scaffold a Next.js app, wire it to Git, and deploy to Vercel with correct build settings and environment variables.

## Workflow Decision Tree
- If the user wants a new app, follow Create App.
- If the app already exists and needs deployment, follow Deploy Existing App.
- If the user mentions build or deploy errors, follow Troubleshoot.

## Create App
1. Confirm requirements: app name, TypeScript, App Router or Pages Router, styling choice (Tailwind or other), linting, and package manager.
2. Scaffold the app using `create-next-app` with the chosen options.
3. Run the dev server locally and confirm the app loads.
4. Initialize Git if needed and make the first commit.
5. If the user wants deployment now, continue with Deploy Existing App.

Reference: See `references/nextjs-scaffold.md` for command variants and flags.

## Deploy Existing App
1. Ensure the app builds locally using `npm run build` (or the selected package manager).
2. Verify `package.json` includes `build` and `start` scripts expected by Next.js.
3. Push the repo to a Git provider or prepare to deploy via the Vercel CLI.
4. Deploy with Vercel and confirm the framework preset is Next.js.
5. Add environment variables in Vercel Project Settings for Preview and Production, then redeploy.

Reference: See `references/vercel-deploy.md` for UI and CLI deploy steps, monorepos, and domains.

## Environment Variables
- Collect required env vars and decide which are needed for Preview vs Production.
- Add local values to `.env.local` and never commit secrets.
- Add the same keys in Vercel Project Settings and trigger a redeploy.

## Troubleshoot
- Build fails locally: run `npm run build`, fix errors, then retry deploy.
- Vercel build fails: check build logs, confirm Node version, and verify required env vars exist.
- Runtime issues: confirm the correct runtime (Node vs Edge) and any serverless function limits.
