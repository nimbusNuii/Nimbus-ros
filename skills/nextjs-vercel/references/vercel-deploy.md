# Vercel Deploy Reference

## Deploy via Vercel UI (Git Import)
1. Push the project to GitHub, GitLab, or Bitbucket.
2. In Vercel, create a new project and import the repo.
3. Confirm the framework preset is Next.js and the build command is `next build`.
4. Set environment variables for Preview and Production.
5. Deploy and verify the Production URL.

## Deploy via Vercel CLI
1. Install the CLI if needed: `npm i -g vercel`.
2. From the project root, run `vercel` for a preview deployment.
3. Run `vercel --prod` to deploy to production.
4. Use `vercel env add` or the Vercel dashboard to manage env vars.

## Monorepo Notes
- Set the correct Root Directory in Vercel Project Settings.
- Ensure the build command runs in the app subfolder.
- Confirm the output directory is the Next.js default unless customized.

## Domains
- Add custom domains in Vercel Project Settings.
- Confirm DNS records match Vercel guidance before switching traffic.
