# AGENTS.md

## Standard

This repo expects direct, modern, maintainable code. Match the stack and conventions already in use instead of inventing new patterns for each task.

## Non-Negotiables

- Follow current best practices for Next.js 16 App Router, React 19, TypeScript, Tailwind 4, and the libraries already installed in this repo.
- Use `pnpm` for dependency management and scripts.
- Read the relevant docs in `node_modules/next/dist/docs/` before changing Next.js behavior, APIs, or file conventions.
- Prefer official library APIs, generators, and CLI workflows over custom abstractions.
- Do not add compatibility layers, fallback branches, or temporary hacks unless they are explicitly required.
- Fix root causes when reasonably possible.

## Code Quality

- Write code that is easy to understand, change, and delete.
- Prefer straightforward control flow and obvious data flow over cleverness.
- Consolidate duplicated logic instead of copying it.
- Do not preserve dead branches, unused props, or outdated helper layers just in case.
- If you touch weak code and the cleanup is local, leave it in a better state.

## App Rules

- Prefer Server Components. Use client components only for state, effects, event handlers, custom hooks, or browser-only APIs.
- Use App Router conventions and the Metadata API.
- Keep route handlers thin. Parse input, call reusable server logic, and return the response.
- Reuse existing server-side loaders and integration code before adding new fetch or transformation paths.
- Keep auth, data loading, and response shaping out of presentation code when they do not belong there.

## UI And Libraries

- `components.json` is the source of truth for UI setup, aliases, and icon library.
- If a shadcn component is needed and not present, add it with the CLI. Do not hand-build a replacement in `src/components/ui`.
- When a UI need maps to an existing shadcn component, use that component directly or add the missing component with the CLI before creating anything custom.
- Do not edit installed shadcn component files just to create a different API or a one-off variant unless the user explicitly asks for that.
- Use the existing `next-auth` setup for authentication work.
- Use TanStack Table for complex table behavior.
- Prefer existing utilities and helpers over adding duplicate formatting, class-merging, or data-mapping helpers.

## External Data And Types

- Keep strict TypeScript intact.
- Avoid `any`, unsafe casts, and non-null assertions unless there is no reasonable alternative.
- Treat Azure DevOps responses and other external data as untrusted at the boundary. Narrow, parse, and normalize them before wider use.
- Prefer explicit types and small focused helpers over stringly-typed behavior.
