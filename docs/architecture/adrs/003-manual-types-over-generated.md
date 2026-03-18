# ADR 003: Manual Types Over Generated

**Status:** Accepted (with known limitations)  
**Date:** January 2026  
**Deciders:** Project team

## Context

Supabase can auto-generate TypeScript types from the database schema via `supabase gen types typescript`. The project needed to decide between:
1. **Generated types** — Auto-generated from the live database schema
2. **Manual types** — Hand-written interfaces in `database.ts`

## Decision

Use **manual TypeScript types** in `src/lib/types/database.ts`.

## Rationale

- **Faster iteration:** No need to run `supabase gen types` after every migration
- **Simpler CI:** No dependency on a live Supabase connection for type generation
- **Custom naming:** Can use idiomatic TypeScript names (e.g., `UserHorse` vs generated snake_case)
- **Selective coverage:** Only types that are actually used in the codebase need to be maintained

## Consequences

- **Known limitation:** Types can drift from the actual schema. Manual sync is required after schema changes.
- The `Database` interface in `database.ts` is not exhaustive — some tables (e.g., `conversations`, `messages`, `groups`) are queried with inline type assertions rather than typed interfaces.
- Server action functions often use `Record<string, unknown>` with manual type assertions instead of fully typed Supabase responses.

## Mitigation

- Migration authors should update `database.ts` when adding columns or tables
- TypeScript `as` assertions narrow the `unknown` types at point of use
- The build step (`npm run build`) catches type errors that would indicate drift

## Future Consideration

If the team grows, switching to auto-generated types with `supabase gen types` would reduce drift risk. This would require:
1. Setting up `supabase gen types typescript --project-id <id>` in CI
2. Replacing manual interfaces with generated output
3. Adjusting server action code to use generated types
