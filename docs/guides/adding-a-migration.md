# Adding a Database Migration

All database changes go through SQL migration files in `supabase/migrations/`.

## Creating a Migration

> **Migrations are files only.** The owner pastes them into the Supabase SQL Editor personally —
> nobody runs `supabase db push`. Two consequences shape everything below: the whole file must be
> **re-runnable** (a half-applied paste has to be fixable by pasting the same file again), and
> the app must **feature-detect** so it works both before and after the paste. See
> [Adding a Feature](adding-a-feature.md#feature-detect-the-schema).

### 1. Choose the Next Number

Check the latest migration file in `supabase/migrations/`. As of the August 2026 launch release the latest is `175_object_metrics.sql`, so the next number is **176**.

> **Note:** Numbers 045, 047, 049 and 051 were consolidated into adjacent migrations during early development, and **174 is an intentional gap** — no such file exists and none should be written.

### 2. Create the File

```
supabase/migrations/176_your_feature_name.sql
```

**Naming conventions:**
- Use snake_case
- Be descriptive: `103_user_preferences.sql`, not `103_update.sql`
- Prefix with a verb for alterations: `103_add_bio_field.sql`

### 3. Write the SQL

Every migration should follow this structure:

```sql
-- ============================================================
-- Migration 103: Feature Name
-- 1. Brief description of change 1
-- 2. Brief description of change 2
-- ============================================================

-- New table
CREATE TABLE IF NOT EXISTS my_new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

-- ALWAYS enable RLS
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "select_own" ON my_new_table FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own" ON my_new_table FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own" ON my_new_table FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "delete_own" ON my_new_table FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ALWAYS add FK indexes
CREATE INDEX IF NOT EXISTS idx_my_new_table_user_id ON my_new_table(user_id);
```

## Migration Rules

### ✅ Always Do

| Rule | Why |
|------|-----|
| Enable RLS on every new table | Security model requirement — no exceptions |
| Add SELECT, INSERT, UPDATE, DELETE policies | Prevent accidental data exposure |
| Index all foreign key columns | PostgreSQL doesn't auto-index FKs |
| Use `IF NOT EXISTS` / `IF EXISTS` | Makes migrations re-runnable |
| Include header comments | Explains what and why at a glance |
| Use `TIMESTAMPTZ` (not `TIMESTAMP`) | Always timezone-aware |
| Use `UUID` for IDs | `gen_random_uuid()` default |

### ❌ Never Do

| Rule | Why |
|------|-----|
| Don't use `CASCADE DELETE` on core tables | Provenance data must survive deletion |
| Don't create tables without RLS | Open data exposure risk |
| Don't hard-code user IDs | Use `(SELECT auth.uid())` |
| Don't skip FK indexes | Causes slow JOINs under load |
| Don't modify old migration files | Always create a new migration |
| Don't write a guard trigger without the service-context bypass | The migration's own backfill will trip it — see below |
| Don't edit migration SQL with a plain-string `String.replace()` | It silently mangles `$$` dollar quotes — see below |
| Don't trust a CHECK constraint you didn't read | Two shipped features wrote values their column's CHECK forbade (079 → 172), and a matview joined on a status the CHECK made impossible (101 → 169) |

## Two Ways a Paste Fails

Both of these cost a hotfix on migration 173. They are not hypothetical.

### Guard triggers must bypass the service context

A `BEFORE UPDATE` trigger enforcing per-user rules will fire on **the migration's own backfill**.
The SQL Editor has no user session, so `auth.uid()` is NULL, the "you cannot edit someone else's
row" branch raises, and the paste aborts halfway through.

```sql
CREATE OR REPLACE FUNCTION public.my_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  -- Service context (SQL editor, service role, crons): no user session,
  -- so the per-user rules below do not apply — this is how the migration
  -- backfill itself runs. RLS keeps clients out.
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;

  -- ... per-user rules ...
  RETURN NEW;
END;
$$;
```

That context is the SQL Editor, the service role and crons — trusted server code that RLS already
distinguishes from clients. The alternative is to order the file so every backfill runs *before*
the triggers are created, but the bypass is more robust because the file stays re-runnable.

### `String.replace()` eats dollar quotes

JavaScript treats `$$` in a **replacement string** as an escape meaning "a literal `$`". So an
automated edit that rewrites a function body will silently collapse every `AS $$` opener it
touches into `AS $` — which is a syntax error the *next* paste discovers, in a file that looks
fine in review.

- Use the **Edit tool** (or a replacement *function*, where `$$` has no special meaning) for
  migration SQL.
- After any scripted edit, **count the dollar-quote tokens** and confirm they are balanced.

### Adding a materialized view? Assert on its row count

`mv_trusted_sellers` refreshed cleanly and produced zero rows for 68 migrations because it joined
on a transfer status the CHECK constraint had never allowed. Nothing errored. Nobody noticed.
A materialized view that refreshes without error is not a view that is working.

## Common Patterns

### Adding a Column

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
```

### Adding a CHECK Constraint

```sql
-- Drop old constraint first (safe if doesn't exist)
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
  CHECK (status IN ('requested', 'accepted', 'declined', 'in_progress', 'completed'));
```

### Creating a View

```sql
CREATE OR REPLACE VIEW my_view AS
SELECT ...
FROM table_a
JOIN table_b ON ...;
```

### Updating an Existing View

Use `CREATE OR REPLACE VIEW` — this is always safe (unlike tables).

### Adding Public Read Access

For tables that should be publicly readable:

```sql
CREATE POLICY "select_public" ON my_table FOR SELECT USING (true);
```

### Participant-Based Access

For two-party data (conversations, transactions):

```sql
CREATE POLICY "participant_access" ON my_table FOR SELECT
  USING (
    party_a_id = (SELECT auth.uid())
    OR party_b_id = (SELECT auth.uid())
  );
```

## Testing a Migration

1. **Open Supabase Dashboard** → SQL Editor
2. **Paste the migration SQL** and run it
3. **Paste it a second time** — it must succeed unchanged. If it doesn't, it isn't re-runnable
4. **Verify** the tables/columns appear correctly, and that any new view returns rows
5. **Test RLS** by querying as different users, including anon
6. **Regenerate TypeScript types:**
   ```bash
   npm run gen-types
   ```

## After Writing the Migration

1. ☐ Ship app code that **feature-detects** the new schema, so the deploy is safe before the paste
2. ☐ Owner pastes the SQL in the Supabase Dashboard (AI never runs `db push`)
3. ☐ Run `npm run gen-types` to regenerate TypeScript types, and replace any interim hand-written types
4. ☐ Update `docs/database/migrations.md` with the new entry
5. ☐ If new table, add to `docs/database/schema-overview.md` **and** `.agents/MASTER_SUPABASE.md`
6. ☐ If new RLS policies, add to `docs/database/rls-policies.md`
7. ☐ Build passes (`npm run build`)

---

**Next:** [Adding a Feature](adding-a-feature.md) · [Schema Overview](../database/schema-overview.md)
