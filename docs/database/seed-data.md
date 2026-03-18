# Seed Data

The reference catalog and achievement badges are populated via scripts and migrations. No user data is seeded — test accounts are created manually.

## Reference Catalog Scripts

Located in `scripts/` at the project root. All require `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### 1. Breyer/Stone Molds

```bash
node scripts/scrape_breyer_molds.mjs
```

Scrapes Breyer mold data from public hobby databases. Outputs to CSV files for review before seeding.

### 2. Breyer/Stone Releases

```bash
node scripts/scrape_releases.mjs   # Scrape release data
node scripts/seed_releases.mjs     # Import into catalog_items
```

Seeds ~10,000+ Breyer and Stone releases as `catalog_items` with `item_type = 'plastic_release'`. Each release links to its parent mold via `parent_id`.

### 3. Artist Resins (ERD)

```bash
node scripts/scrape_erd.mjs        # Scrape from Equine Resin Directory
node scripts/seed_erd_resins.mjs   # Import into catalog_items
```

Scrapes artist resin data from the [Equine Resin Directory](https://equineresindirectory.com/) (IDs 1–5000). Seeds as `catalog_items` with `item_type = 'artist_resin'`.

> ⚠️ **Rate limiting:** The scrape scripts use a polite rate limit (~200ms between requests). Full scrape takes ~15 minutes.

### 4. Catalog Structure

The `catalog_items` table uses a **polymorphic parent-child** pattern:

```
catalog_items (item_type = 'plastic_mold')     ← Mold: "Traditional Breyer #700"
  └── catalog_items (item_type = 'plastic_release') ← Release: "Secretariat 2005 Palomino"
  └── catalog_items (item_type = 'plastic_release') ← Release: "Secretariat 2008 Bay"

catalog_items (item_type = 'artist_resin')     ← Resin: "Seunta by Sarah Minkiewicz"
```

### 5. Achievement Badges

Badges are seeded in migration `085_gamification_engine.sql`. No separate script needed.

**Seeded badge categories:**
- `collection` — Herd Builder I/II/III (10/50/100 models)
- `social` — Social engagement achievements
- `commerce` — Trading milestones
- `community` — Community participation

## Re-Seeding

Both seed scripts **clear existing data** by default before inserting. To reseed:

```bash
# Full reseed (clears and reimports)
node scripts/seed_releases.mjs
node scripts/seed_erd_resins.mjs
```

## Data Counts (as of March 2026)

| Source | Count | Table |
|--------|-------|-------|
| Breyer/Stone releases | ~10,000 | `catalog_items` (plastic_release) |
| Breyer/Stone molds | ~500 | `catalog_items` (plastic_mold) |
| Artist resins (ERD) | ~500 | `catalog_items` (artist_resin) |
| Achievement badges | 10+ | `badges` |

---

**Next:** [Schema Overview](schema-overview.md) · [Migrations](migrations.md)
