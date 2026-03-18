# Catalog Curation Guide

This guide explains how the community-driven catalog curation system works, from suggesting corrections to earning Trusted Curator status.

## How It Works

The Model Horse Hub reference catalog contains 10,500+ entries (molds, releases, resins, tack). Community members can browse the catalog publicly, and logged-in users can suggest corrections, additions, and photo submissions. Other users vote and discuss suggestions to help admins make informed decisions.

## Browsing the Catalog

Visit **[/reference](/reference)** to browse the full catalog. Features include:

- **Search** — Search by name, mold, color, maker
- **Filter chips** — Quick filter by maker (Breyer, Stone, etc.)
- **Scale dropdown** — Filter by Traditional, Classic, Stablemate, etc.
- **Sortable columns** — Click column headers to sort
- **Click-through** — Click any row to view full details

## Suggesting Changes

### Corrections
Click **✏️ Suggest Edit** on any catalog item to propose corrections. The modal pre-fills all existing fields — edit the ones that need correction.

**Required:** A reason explaining your correction (minimum 10 characters). Good reasons include:
- "The 2019 Breyer catalog lists this as Dark Bay, not Bay"
- "Production run was 5000 per the Breyer Collector's Guide"

### New Entries
If a model is missing from the catalog entirely, use the **📗 Suggest New Entry** option.

### Photo Submissions
Submit reference photos for catalog entries. Photos are limited to **500KB each** to manage storage costs.

## Voting & Discussion

Every suggestion has:
- **▲ Upvote / ▼ Downvote** — Vote to signal agreement or disagreement
- **💬 Discussion thread** — Add comments with evidence, context, or questions

Votes and discussions help admins prioritize and evaluate suggestions.

## Trusted Curator System

As your suggestions get approved, you earn curator status:

| Tier | Badge | Threshold | Auto-Approve Scope |
|------|-------|-----------|-------------------|
| Catalog Contributor | 📘 | 1+ approved | None (all suggestions reviewed) |
| Bronze Curator | 🥉 | 10+ approved | None |
| Silver Curator | 🥈 | 50+ approved | Color, Year, Production Run, Release Date corrections |
| Gold Curator | 🥇 | 200+ approved | All correction suggestions |

### Auto-Approve Rules

- **Silver curators** can auto-approve corrections where *all* changed fields are: `color`, `year`, `production_run`, `release_date`
- **Gold curators** can auto-approve *all* correction suggestions
- **Additions and removals** always require admin review, regardless of curator tier
- Auto-approved changes are marked with ⚡ in the changelog

## Suggestion Statuses

| Status | Meaning |
|--------|---------|
| 🟡 Pending | Awaiting admin review |
| 🔍 Under Review | Admin is evaluating |
| ✅ Approved | Changes applied to catalog |
| ⚡ Auto-Approved | Trusted curator's change applied automatically |
| ❌ Rejected | Change not applied (admin provides reason) |

## Public Changelog

View all approved changes at **[/reference/changelog](/reference/changelog)**. Each entry shows:
- What changed
- Who contributed it
- When it was approved

## Admin Review

Admins see a **📚 Catalog** tab in the admin console with:
- All pending suggestions
- Author info with curator badge
- Diff preview of proposed changes
- Vote counts and community sentiment
- Inline approve/reject buttons

---

**Related:** [Database Schema](../database/schema-overview.md#catalog-curation-v32) · [Server Actions](../api/server-actions.md#-catalog-curation-v32)
