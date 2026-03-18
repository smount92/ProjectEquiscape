# Adding a Database Migration

All database changes go through SQL migration files in `supabase/migrations/`.

## Creating a Migration

### 1. Choose the Next Number

Check the latest migration file in `supabase/migrations/`. As of March 2026, the latest is `089_commission_wip_photos.sql`, so the next number is **090**.

> **Note:** Numbers 045, 047, 049, and 051 are intentionally skipped (consolidated into adjacent migrations during early development).

### 2. Create the File

```
supabase/migrations/090_your_feature_name.sql
```

**Naming conventions:**
- Use snake_case
- Be descriptive: `090_user_preferences.sql`, not `090_update.sql`
- Prefix with a verb for alterations: `090_add_bio_field.sql`

### 3. Write the SQL

Every migration should follow this structure:

```sql
-- ============================================================
-- Migration 090: Feature Name
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
3. **Verify** the table/columns appear correctly
4. **Test RLS** by querying as different users
5. **Update TypeScript types** in `src/lib/types/database.ts`

## After Writing the Migration

1. ☐ Test the SQL in Supabase Dashboard
2. ☐ Update `src/lib/types/database.ts` if new tables/columns
3. ☐ Update `docs/database/migrations.md` with the new entry
4. ☐ If new table, add to `docs/database/schema-overview.md`
5. ☐ If new RLS policies, add to `docs/database/rls-policies.md`
6. ☐ Build passes (`npm run build`)

---

**Next:** [Adding a Feature](adding-a-feature.md) · [Schema Overview](../database/schema-overview.md)
