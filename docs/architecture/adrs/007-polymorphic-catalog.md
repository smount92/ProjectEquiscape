# ADR 007: Polymorphic Catalog (Universal Reference)

**Status:** Accepted  
**Date:** February 2026  
**Deciders:** Project team

## Context

The model horse hobby has diverse collectible types:
- Breyer factory molds (parent items)
- Breyer/Stone releases (child items of molds)
- Artist resins
- Tack, medallions, micro-minis, props, dioramas

Early schema had separate tables for molds vs releases. This caused duplicate logic and prevented unified search.

## Decision

Use a **single polymorphic `catalog_items` table** with `item_type` discriminator and a **self-referencing `parent_id`** for hierarchical relationships.

## Rationale

- **Unified search:** One query searches across all collectible types
- **Extensible:** New item types (medallions, tack) are added without new tables
- **Hierarchical:** `parent_id` links releases to molds naturally
- **JSONB attributes:** Type-specific fields (paint, year, sculptor) live in `attributes` column

## Implementation

Migration `048_universal_catalog.sql`:

```sql
CREATE TABLE catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL,  -- 'plastic_mold', 'plastic_release', 'artist_resin', etc.
    parent_id UUID REFERENCES catalog_items(id),
    title TEXT NOT NULL,
    maker TEXT NOT NULL,
    scale TEXT,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

TypeScript enum:

```typescript
type CatalogItemType = 
    "plastic_mold" | "plastic_release" | "artist_resin" | 
    "tack" | "medallion" | "micro_mini" | "prop" | "diorama";
```

### Example Data

```
catalog_items:
  { item_type: "plastic_mold",    title: "Traditional Breyer #700",  parent_id: null }
  { item_type: "plastic_release", title: "Secretariat 2005 Palomino", parent_id: "<mold_id>" }
  { item_type: "artist_resin",    title: "Seunta",                   parent_id: null }
```

### Linking to User Horses

`user_horses.catalog_id` → `catalog_items.id` (nullable FK). Users can also create horses without a catalog reference.

## Consequences

- All catalog queries must filter by `item_type` when type-specific results are needed
- The `attributes` JSONB column is schema-less — validation is application-side
- Reference search (UnifiedReferenceSearch) must handle multiple item types in results
- Price guide aggregation groups by `catalog_id` + `finish_type` across the materialized view
