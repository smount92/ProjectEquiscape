---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-07
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.
> **Archive:** Completed tasks are moved to `dev-nextsteps-archive.md` in this same directory.

// turbo-all

## How to Use This Workflow

1. Read this entire file to understand pending tasks
2. Start with 🔴 Critical items first, then 🟡 Medium, then 🟢 Nice-to-Have
3. Each task has clear instructions — follow them exactly
4. After completing a task, mark it ✅ in this file
5. Run `npm run build` after each task to verify nothing broke
6. Commit with a descriptive message after completing a batch of related tasks

---

## Pre-flight

Before starting any work, read the developer conventions:

```
Look for 02_developer_conventions.md in any brain artifacts directory under C:\Users\MTG Test\.gemini\antigravity\brain\
```

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# OPTION 6: MARKETING & CONTENT — Landing, About, Features
# ═══════════════════════════════════════

> **Context:** The platform now has 10,500+ reference entries (7,000+ Breyer releases + 3,500+ artist resins from Equine Resin Directory). Feature set is complete: intake wizard, collections, vault, marketplace, Photo Shows with winners/deadlines/admin, social layer, Hoofprint™ provenance (coming soon). The landing page needs to sell this story.

# 🔴 Priority: Critical (First Impressions)

## ✅ Task MK-1: Landing Page Hero — Sharpen the Value Prop

**Problem:** The current hero says "The Ultimate Digital Stable for Model Horse Collectors" — it's generic. It doesn't create urgency or address a pain point.

**What to change:**

**File:** `src/app/page.tsx`

### 1. Update meta description (line ~6-7):
```typescript
description: "Catalog your model horse collection with 10,500+ reference releases and artist resins, LSQ multi-angle photography, a private financial vault, community marketplace, virtual photo shows, and Hoofprint™ provenance tracking. Free forever.",
```

### 2. Update the hero badge:
```tsx
<span className="hero-badge">🐾 Introducing Hoofprint™ — Living Provenance for Model Horses</span>
```

### 3. Update the hero headline:
```tsx
<h1 className="hero-headline">
    Your Herd Deserves More Than{" "}
    <span className="text-gradient">a Spreadsheet</span>
</h1>
```

### 4. Update the hero subheadline — make it pain-driven:
```tsx
<p className="hero-subheadline">
    Stop tracking your collection across notebooks, Facebook albums, and half-forgotten spreadsheets.
    Model Horse Hub is the all-in-one digital stable with a 10,500+ reference database,
    multi-angle photo galleries, a secure financial vault, and the only
    provenance tracking system in the hobby.
</p>
```

### 5. Update stats section — reflect real numbers:
```tsx
<div className="stat-item">
    <span className="stat-value">10,500+</span>
    <span className="stat-label">Releases & Resins</span>
</div>
<div className="stat-divider" aria-hidden="true" />
<div className="stat-item">
    <span className="stat-value">🐾</span>
    <span className="stat-label">Hoofprint™ Tracking</span>
</div>
<div className="stat-divider" aria-hidden="true" />
<div className="stat-item">
    <span className="stat-value">🔒</span>
    <span className="stat-label">Privacy-First</span>
</div>
<div className="stat-divider" aria-hidden="true" />
<div className="stat-item">
    <span className="stat-value">100%</span>
    <span className="stat-label">Free to Start</span>
</div>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task MK-2: "How It Works" — 3-Step Visual Walkthrough

**Problem:** New visitors don't see the product in action. They read feature descriptions but can't visualize the experience.

**What to build:**

**File:** `src/app/page.tsx`

Add a new section BETWEEN the hero and the features grid. Insert it after the closing `</section>` of `hero-section` and before `features-section`:

```tsx
{/* ─── How It Works ─── */}
<section className="how-it-works-section" id="how-it-works">
    <div className="how-inner">
        <h2 className="features-title">
            Get Started in <span className="text-gradient">3 Steps</span>
        </h2>
        <p className="features-subtitle">
            From your shelf to the Show Ring in under 5 minutes.
        </p>
        <div className="how-steps">
            <div className="how-step">
                <div className="how-step-number">1</div>
                <div className="how-step-icon">📸</div>
                <h3>Add Your Horse</h3>
                <p>
                    Search our 10,500+ reference database to instantly identify your model.
                    Upload multi-angle LSQ photos, set condition grades, and track purchase details
                    in your private financial vault.
                </p>
            </div>
            <div className="how-step-arrow" aria-hidden="true">→</div>
            <div className="how-step">
                <div className="how-step-number">2</div>
                <div className="how-step-icon">🏆</div>
                <h3>Join the Community</h3>
                <p>
                    Publish your best models to the Show Ring for the community to discover.
                    Enter virtual photo shows, follow other collectors, and build your reputation
                    with verified ratings.
                </p>
            </div>
            <div className="how-step-arrow" aria-hidden="true">→</div>
            <div className="how-step">
                <div className="how-step-number">3</div>
                <div className="how-step-icon">🐾</div>
                <h3>Build Your Hoofprint</h3>
                <p>
                    Every horse gets a permanent digital identity. Track it from blank resin
                    to finished custom, through ownership changes, with a provenance chain
                    that follows the horse forever.
                </p>
            </div>
        </div>
    </div>
</section>
```

**CSS to add to `src/app/globals.css`:**

```css
/* ===== How It Works ===== */
.how-it-works-section {
    padding: var(--space-3xl) var(--space-xl);
    text-align: center;
}

.how-inner {
    max-width: 1100px;
    margin: 0 auto;
}

.how-steps {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: var(--space-lg);
    margin-top: var(--space-2xl);
}

.how-step {
    flex: 1;
    max-width: 320px;
    text-align: center;
    padding: var(--space-xl) var(--space-lg);
    border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: transform 0.3s, border-color 0.3s;
}

.how-step:hover {
    transform: translateY(-4px);
    border-color: rgba(124, 109, 240, 0.3);
}

.how-step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-accent-primary-glow);
    color: var(--color-accent-primary);
    font-weight: 700;
    font-size: 0.85rem;
    margin-bottom: var(--space-md);
}

.how-step-icon {
    font-size: 2.5rem;
    margin-bottom: var(--space-md);
}

.how-step h3 {
    font-size: calc(1.1rem * var(--font-scale));
    margin-bottom: var(--space-sm);
}

.how-step p {
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    color: var(--color-text-muted);
    line-height: 1.6;
}

.how-step-arrow {
    display: flex;
    align-items: center;
    font-size: 1.5rem;
    color: var(--color-text-muted);
    padding-top: var(--space-3xl);
}

@media (max-width: 768px) {
    .how-steps {
        flex-direction: column;
        align-items: center;
    }
    .how-step-arrow {
        transform: rotate(90deg);
        padding-top: 0;
    }
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task MK-3: Feature Cards — Pain-to-Solution Rewrite

**Problem:** The 6 feature cards are descriptive but don't connect emotionally. They all look identical with no hierarchy.

**What to change:**

**File:** `src/app/page.tsx`

Rewrite the features section title:
```tsx
<h2 className="features-title">
    Six Pillars That Make Your{" "}
    <span className="text-gradient">Collection Unstoppable</span>
</h2>
<p className="features-subtitle">
    Every feature was designed around real collector frustrations — because we are collectors too.
</p>
```

Rewrite each feature card's title and description to follow the **"Pain → Solution"** pattern:

### Card 1 — Reference Database:
```tsx
<h3 className="feature-card-title">10,500+ Reference Releases</h3>
<p className="feature-card-desc">
    Stop Googling "Breyer palomino 1995." Our database covers 7,000+ Breyer and Stone
    releases plus 3,500+ artist resins from the Equine Resin Directory. Search by mold,
    sculptor, scale, or year — and identify any model in seconds.
</p>
```

### Card 2 — Financial Vault:
```tsx
<h3 className="feature-card-title">Private Financial Vault</h3>
<p className="feature-card-desc">
    Know what your collection is really worth — without anyone else seeing.
    Track purchase prices, estimated values, and insurance notes in a vault
    that only you can access. Even our team can't see your data.
</p>
```

### Card 3 — Community Show Ring:
```tsx
<h3 className="feature-card-title">Community Show Ring</h3>
<p className="feature-card-desc">
    Your proudest models deserve an audience. Browse other collectors' herds,
    filter by scale, manufacturer, and finish type, and discover
    your next obsession — or your next purchase.
</p>
```

### Card 4 — Social Community:
```tsx
<h3 className="feature-card-title">Follow Your Favorite Collectors</h3>
<p className="feature-card-desc">
    No more scrolling through Facebook groups hoping to see updates.
    Follow the collectors you care about, see their new additions in your feed,
    and build real connections in a space made for the hobby.
</p>
```

### Card 5 — Virtual Photo Shows:
```tsx
<h3 className="feature-card-title">Virtual Photo Shows</h3>
<p className="feature-card-desc">
    Can't make it to a live show? Enter themed virtual shows, vote for your favorites,
    and compete for 🥇🥈🥉 placement — all from home. Shows run on deadlines with
    real results.
</p>
```

### Card 6 — Trusted Marketplace:
```tsx
<h3 className="feature-card-title">Buy, Sell & Trade with Confidence</h3>
<p className="feature-card-desc">
    List models for sale with multi-angle photos, message buyers directly,
    and build your seller rating. Wishlist matchmaking alerts you when your
    dream horse goes on the market.
</p>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task MK-4: Hoofprint™ Teaser Section

**Problem:** The platform's most unique feature — Hoofprint™ — has zero presence on the landing page.

**What to build:**

**File:** `src/app/page.tsx`

Add a new section AFTER the features grid and BEFORE the stats section:

```tsx
{/* ─── Hoofprint™ Teaser ─── */}
<section className="hoofprint-teaser-section" id="hoofprint-teaser">
    <div className="hoofprint-teaser-inner">
        <div className="hoofprint-teaser-badge">🐾 Coming Soon</div>
        <h2 className="hoofprint-teaser-title">
            Every Horse Has a Story.{" "}
            <span className="text-gradient">Hoofprint™ Tells It.</span>
        </h2>
        <p className="hoofprint-teaser-desc">
            Imagine a permanent digital identity for every model horse.
            From the moment a blank resin is cast, through the artist's brushstrokes,
            to the collector who treasures it for years — and the next collector after that.
        </p>
        <p className="hoofprint-teaser-desc">
            Hoofprint™ is the first-ever living provenance system for model horses.
            Photos, ownership transfers, customization records, and show results
            all follow the horse — not the owner. Like a passport that never expires.
        </p>
        <div className="hoofprint-teaser-features">
            <div className="hoofprint-teaser-feature">
                <span>📸</span>
                <strong>Photo Timeline</strong>
                <span>Track every stage from blank to finished</span>
            </div>
            <div className="hoofprint-teaser-feature">
                <span>🤝</span>
                <strong>Ownership Chain</strong>
                <span>Verified history follows the horse forever</span>
            </div>
            <div className="hoofprint-teaser-feature">
                <span>📦</span>
                <strong>One-Click Transfer</strong>
                <span>Sell a horse and pass its entire history along</span>
            </div>
        </div>
    </div>
</section>
```

**CSS to add to `src/app/globals.css`:**

```css
/* ===== Hoofprint Teaser ===== */
.hoofprint-teaser-section {
    padding: var(--space-3xl) var(--space-xl);
    text-align: center;
    background: linear-gradient(180deg, transparent 0%, rgba(245, 158, 11, 0.03) 50%, transparent 100%);
}

.hoofprint-teaser-inner {
    max-width: 720px;
    margin: 0 auto;
}

.hoofprint-teaser-badge {
    display: inline-block;
    padding: var(--space-xs) var(--space-lg);
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    font-weight: 600;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: var(--radius-full);
    margin-bottom: var(--space-xl);
    letter-spacing: 0.02em;
}

.hoofprint-teaser-title {
    font-size: clamp(1.5rem, 3.5vw, 2.5rem);
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: var(--space-lg);
}

.hoofprint-teaser-desc {
    font-size: calc(var(--font-size-base) * var(--font-scale));
    color: var(--color-text-muted);
    line-height: 1.7;
    margin-bottom: var(--space-md);
}

.hoofprint-teaser-features {
    display: flex;
    gap: var(--space-lg);
    margin-top: var(--space-2xl);
    justify-content: center;
    flex-wrap: wrap;
}

.hoofprint-teaser-feature {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    flex: 1;
    min-width: 180px;
    max-width: 220px;
}

.hoofprint-teaser-feature span:first-child {
    font-size: 2rem;
}

.hoofprint-teaser-feature strong {
    font-size: calc(0.9rem * var(--font-scale));
}

.hoofprint-teaser-feature span:last-child {
    font-size: calc(0.8rem * var(--font-scale));
    color: var(--color-text-muted);
    text-align: center;
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## ✅ Task MK-5: "Who It's For" — Collector Personas

**Problem:** Visitors ask "Is this for me?" The page doesn't answer that.

**What to build:**

**File:** `src/app/page.tsx`

Add a section AFTER the Hoofprint teaser and BEFORE the stats:

```tsx
{/* ─── Who It's For ─── */}
<section className="personas-section" id="who-its-for">
    <div className="features-inner">
        <h2 className="features-title">
            Built for <span className="text-gradient">Every Collector</span>
        </h2>
        <div className="personas-grid">
            <div className="persona-card">
                <div className="persona-emoji">🏡</div>
                <h3>The Growing Herd</h3>
                <p>
                    You've got 20–100 models and they're multiplying.
                    You need a real system before that spreadsheet
                    collapses under its own weight.
                </p>
            </div>
            <div className="persona-card">
                <div className="persona-emoji">🎨</div>
                <h3>The Artist & Customizer</h3>
                <p>
                    You paint, body-mod, and create. You want to document every
                    WIP stage — and give buyers a verified history of your work
                    when it's time to sell.
                </p>
            </div>
            <div className="persona-card">
                <div className="persona-emoji">🏆</div>
                <h3>The Shower & Competitor</h3>
                <p>
                    Live shows, photo shows, NAN qualifications — you need show records,
                    provenance tracking, and a way to show off your winners
                    to the community.
                </p>
            </div>
        </div>
    </div>
</section>
```

**CSS to add:**

```css
/* ===== Personas ===== */
.personas-section {
    padding: var(--space-3xl) var(--space-xl);
    text-align: center;
}

.personas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-xl);
    margin-top: var(--space-2xl);
}

.persona-card {
    padding: var(--space-xl);
    border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    text-align: center;
    transition: transform 0.3s, border-color 0.3s;
}

.persona-card:hover {
    transform: translateY(-4px);
    border-color: rgba(124, 109, 240, 0.3);
}

.persona-emoji {
    font-size: 3rem;
    margin-bottom: var(--space-md);
}

.persona-card h3 {
    font-size: calc(1.1rem * var(--font-scale));
    margin-bottom: var(--space-sm);
}

.persona-card p {
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    color: var(--color-text-muted);
    line-height: 1.6;
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task MK-6: About Page — Real Story & Vision

**Problem:** The About page is thin, generic, and reads like corporate copy. Collectors buy from people, not companies.

**What to change:**

**File:** `src/app/about/page.tsx`

Rewrite the entire page. Keep the `static-page` wrapper and CSS classes. New content should include:

### Section 1: "Our Story" (personal, authentic)
- Talk about the real frustration: notebooks, spreadsheets, Facebook albums
- The moment of "why doesn't this exist?"
- Mention the reference database sourcing (7k+ Breyer releases hand-verified, plus 3,500+ artist resins from the Equine Resin Directory)
- "Built by a collector who was tired of the status quo"

### Section 2: "What Makes Us Different" (3 cards, replace current mission cards)

Card 1: **"Your Data is YOURS"**
- Row-level security means even the team can't see your financial vault
- No ads, no selling your collection data

Card 2: **"Built for the Hobby's Nuances"**
- We know what LSQ means. We know the difference between OF and CM. 
- Every feature was designed around how collectors actually work

Card 3: **"Hoofprint™ — A First for the Hobby"**
- No platform has ever built provenance tracking for model horses
- We're creating the CarFax equivalent for the community

### Section 3: "The Vision" (short, aspirational)
- Where Model Horse Hub is going
- Community-driven features
- "We're building the platform we always wished existed"

### Section 4: CTA
- Keep the existing signup CTA but update copy:
```tsx
<p>Your herd is waiting. Give it the home it deserves.</p>
<Link href="/signup" ...>Start Your Digital Stable — Free</Link>
```

### Update footer links to include Features:
```tsx
<Link href="/about" ...>About</Link>
<Link href="/features" ...>Features</Link>
<Link href="/contact" ...>Contact</Link>
<Link href="/community" ...>Show Ring</Link>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task MK-7: Update Landing Page Footer

**Problem:** Footer only has About, Contact, Show Ring. Missing Features link and social/community links.

**File:** `src/app/page.tsx`

Update the footer nav to include:
```tsx
<nav className="footer-nav" aria-label="Footer navigation">
    <Link href="/about" className="footer-link" id="footer-about">About</Link>
    <Link href="/contact" className="footer-link" id="footer-contact">Contact</Link>
    <Link href="/community" className="footer-link" id="footer-showring">Show Ring</Link>
    <Link href="/discover" className="footer-link" id="footer-discover">Discover Collectors</Link>
</nav>
```

Update the footer CTA section copy:
```tsx
<h2>
    Ready to Give Your Herd{" "}
    <span className="text-gradient">a Real Home</span>?
</h2>
<p>
    Join the collectors who catalog, connect, and trade on the only platform built for the model horse hobby.
</p>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task MK-8: Commit & Push Marketing Content

After all MK tasks are complete:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "content: landing page overhaul, about rewrite, hoofprint teaser, collector personas" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
