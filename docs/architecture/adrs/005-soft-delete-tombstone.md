# ADR 005: Soft Delete (Tombstone) Pattern

**Status:** Accepted  
**Date:** February 2026  
**Deciders:** Project team

## Context

When users delete horses, the database has foreign key references from:
- `horse_ownership_history` (provenance chain)
- `show_records` (competition history)
- `horse_transfers` (transfer records)
- `transactions` (commerce history)
- `reviews` (post-transaction reviews)

Hard DELETE would violate FK constraints or cascade-delete historical records that should be permanent.

## Decision

Use **soft delete (tombstone)** for records that are referenced by other tables. Set `is_tombstone = true` and `deleted_at = now()` instead of DELETE.

## Rationale

- Preserves referential integrity — FK references remain valid
- Historical data survives — provenance and commerce records are permanent
- Reversible — tombstoned records can be restored
- RLS policies filter tombstoned records from normal queries

## Implementation

Migration `034_tombstone_deletion.sql` adds tombstone columns:

```sql
ALTER TABLE user_horses ADD COLUMN is_tombstone BOOLEAN DEFAULT false;
ALTER TABLE user_horses ADD COLUMN deleted_at TIMESTAMPTZ;
```

Queries filter tombstoned records:

```sql
SELECT * FROM user_horses WHERE owner_id = auth.uid() AND is_tombstone = false;
```

Server actions check `is_tombstone`:

```typescript
const { data } = await supabase
    .from("user_horses")
    .select("*")
    .eq("owner_id", user.id)
    .eq("is_tombstone", false);
```

## Consequences

- All queries on `user_horses` must include `is_tombstone = false` (or the RLS policy handles it)
- Storage cleanup (images) runs separately via garbage collection (migration 068)
- The transfer history page shows tombstoned horse data (name + thumbnail survive)
