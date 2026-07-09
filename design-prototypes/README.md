# Design Prototypes — Leather Edition (July 2026)

Static HTML mocks that drove the leather-edition design direction. Open any
file directly in a browser — all textures are pure CSS (gradients + SVG
noise), no assets, no build step.

| File | What it is | Status |
|---|---|---|
| `trophy-case-prototype.html` | First CSS feasibility test of the skeuomorphic direction: leather masthead, strap nav, wood trophy cabinet, brass plaques, "working surface" hybrid argument, full-texture ↔ flat-token toggle (= Simple Mode preview). | Approved (plaque contrast fixed) |
| `working-surface-options.html` | Three secondary-material concepts for working surfaces (dashboard/market/forms): **A · Stable Ledger** (green-ruled), B · Show Binder, C · Saddle-Pad Linen. | **A + green chosen** |
| `stable-profile-mock-day-only.html` | ✅ **CHECKPOINT** — approved public-profile showcase exactly as signed off (masthead, stats strap, Stars of the Stable, trophy plaques, show ledger), *before* the lamplight dark-mode exploration. | Approved |
| `stable-profile-mock.html` | Same mock plus the 🌙 Lamplight (dark mode) exploration with day/night toggle. | Under review |

Git checkpoint: tag `design-checkpoint-pre-lamplight` marks the
`design/leather-edition` branch state (commit `c4e66db`) with the complete
approved leather edition, before any dark-mode work.

The implemented (live-data) versions live on the `design/leather-edition`
branch: site-wide materials in `src/app/globals.css` ("Materials" section),
`/design` variant gallery, `/design/feed`, and the rebuilt public profile.
