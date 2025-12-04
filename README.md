<div align="center">
   <img align="center" width="128px" src="https://avatars.githubusercontent.com/u/140384842?s=200&v=4" />
   <h1 align="center"><b>Baz CLI</b></h1>
   <p align="center">
      CLI interface for AI code review: Automated logic, security, performance and design reviews (and more).
      <br />
      <a href="https://github.com/baz-scm/"><strong>Baz on GitHub »</strong></a>
      <br />
      <br />
      <b>Install via NPM</b>
      <br />
      <code>npm install @baz-scm/cli</code>
      <br />
   </p>
</div>

---
## Quick start

1. Install globally: `npm install -g @baz-scm/cli`
2. Authenticate once: `baz auth login`
3. Run a review: `baz review` (or simply `baz`)

If you prefer local, project-scoped usage, install with `npm install @baz-scm/cli` and invoke commands via `npx baz`.

## Requirements
- Node.js 22 or later (see `"engines"` in `package.json`)
- Access to Baz and your source control provider
- Optional: Jira, Linear, or YouTrack integration for issue selection

## Installation
Install the published package globally to make `baz` available on your PATH:

```bash
npm install -g @baz-scm/cli
baz --version
```

If you prefer a local install inside a project:

```bash
npm install @baz-scm/cli
npx baz --version
```

## Configuration
Create a `.env` file alongside your project or in the directory where you run the CLI to override defaults. The most common settings are:

```
# Baz service endpoint
BAZ_BASE_URL=https://baz.co

# Descope OAuth settings (defaults are included for convenience)
DESCOPE_BASE_URL=https://api.descope.com
DESCOPE_PROJECT_ID=<your_project_id>
DESCOPE_CLIENT_ID=<your_client_id>

# Local OAuth callback port
OAUTH_CALLBACK_PORT=8020
```

The CLI also respects `LOG_LEVEL` (`fatal`, `error`, `warn`, `info`, `debug`) and `NODE_ENV` for tuning output. Environment variables are read at runtime, so you can adjust them without rebuilding the CLI.

## Authentication
Authenticate once before running reviews:

```bash
baz auth login
```

- A browser window opens for the Descope OAuth flow.
- Successful login caches tokens locally so subsequent commands run without prompts.
- To clear tokens, run:

```bash
baz auth logout
```

## Usage
Launch the interactive review experience:

```bash
baz review
```

What to expect:
1. **Repository selection** – Search and select a repository.
2. **Pull request selection** – Choose the PR to review; use the back option to change the repository.
3. **Integration check** – If no ticketing integration is detected, you can set one up or skip.
4. **Issue selection** – Browse and pick a related issue when integrations are available; skipping is allowed.
5. **Review actions** – Inspect PR details, summarize findings, and choose to review another PR or exit.

The review command is also the default, so running `baz` without subcommands starts the same flow.

## Development
Clone the repository and install dependencies:

```bash
npm install
```

Useful scripts:

- `npm run dev` – Start the CLI in watch mode with `tsx` for rapid iteration.
- `npm run build` – Generate compiled output in `dist/` using TypeScript.
- `npm run lint` / `npm run lint:fix` – Run ESLint checks (with caching) or auto-fix issues.
- `npm run format:check` / `npm run format:fix` – Verify or format source files with Prettier.

When developing new features, ensure your Node version matches the required engine and keep environment variables in a `.env` file for local runs.
