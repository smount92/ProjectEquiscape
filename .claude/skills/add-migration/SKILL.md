---
name: add-migration
description: Use whenever a change needs the database schema to change - a new table, column, constraint, policy, function or trigger.
---

# Add a migration

Full guide: `docs/guides/adding-a-migration.md`. The rules that matter most:

1. **Number**: the next number after the highest file in `supabase/migrations/`. Never reuse a number.
2. **Re-runnable**: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS` first. The owner may paste it twice.
3. **Header comment**: what problem it solves, in plain words, and anything the owner must know before pasting.
4. **Security**: RLS on every new table; UPDATE policies have `WITH CHECK`; `SECURITY DEFINER` functions set `search_path = ''` and restate visibility checks. When replacing a function, diff it against the **previous** version - permission regressions arrive with bug-fix migrations.
5. **Vocabulary columns** get a CHECK constraint or a lookup table, never free text (`docs/STANDARDS.md`).
6. **Probe**: add an entry to `PENDING_MIGRATIONS` in `src/app/actions/admin.ts` so Admin › Ops shows whether it was pasted.
7. **Feature-detect**: code must work before the migration is pasted (degrade, don't crash).
8. **Data**: one-off data repairs go in `scripts/catalog-delta/` with a dry run (`registry-data-fix`), not in a migration.
9. **Hand over**: tell the owner the file path. The owner pastes it into the Supabase SQL editor. Never `supabase db push`, never type into their editor.
10. After it is pasted: `npm run gen-types`, then confirm the probe turned green.
