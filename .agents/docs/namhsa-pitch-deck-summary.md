# How MHH Partners with NAMHSA

> A one-page summary for the NAMHSA VP meeting
> **Created:** 2026-04-03 | **Sprint complete:** 2026-04-03 | **Meeting Target:** ~2026-05-15

---

## Our Role

Model Horse Hub is a **digital toolsuite** that makes the showing experience better for hosts, judges, and exhibitors. We don't replace any NAMHSA process — we automate the tedious paperwork so volunteers can focus on the horses.

**Currently live:** 84 registered users, 903 horses, 80+ show records, 5 events, 10,964 catalog items.

---

## What We Already Built (Live Today)

| Feature | What It Does |
|---------|-------------|
| 🏆 **NAMHSA Class Templates** | 1-click setup: Standard Halter (5 divisions, 17 classes), Performance (3 divisions, 13 classes), Collectibility (2 divisions, 8 classes) |
| 📋 **NAN Card Tracking** | Green/Yellow/Pink card types tracked per horse per year, with 4-year validation window |
| 🛡️ **Platform-Verified Records** | Records from MHH-hosted shows carry a "MHH Verified" badge with full digital provenance (entry → judging → placement). Self-reported records are visually distinct |
| 🏷️ **Show Tags PDF** | Professional exhibitor + host show tags with QR codes — replaces handwritten masking-tape tags |
| 🧳 **Live Show Packer** | Plan your show string, detect ring/handler time conflicts before arriving at the show |
| 🎯 **Blind Voting** | Photo shows with hidden horse ownership for fair community judging |
| 🎨 **Visual Judging** | Ribbon stamp interface for expert judges — tactile, visual, fast |
| 👨‍⚖️ **Judge Assignments** | Expert judge system with precedence over community votes, COI conflict detection |
| 📊 **Public Results** | Shareable public URL for show results — perfect for social media and NAMHSA reporting |
| 📥 **CSV Export** | Results export in NAMHSA-compatible format (exhibitor, horse, class, division, placement) |
| 📱 **Offline Barn Mode** | PWA works at fairgrounds with no cell signal — show packer, horse details, all offline |
| 🗺️ **Regional Groups** | 11 NAMHSA regions mapped, regional clubs with show activity visibility |

---

## Live Demo Script (10 minutes)

1. **Create a show** → apply "Standard Halter (NAMHSA Style)" template *(30 seconds)*
2. **Open entries** → enter 3 horses → show the amber "NAN" qualifying badge on classes
3. **Judge the show** → stamp ribbons in the visual judging UI → close the show
4. **View public results** → show the shareable URL, "NAMHSA Sanctioned" badge, division/class breakdown
5. **Download show tags PDF** → show QR code, host vs. exhibitor variants
6. **Open NAN Dashboard** → show green/yellow/pink cards with 4-year window → export CSV
7. **Live Show Packer** → add horses to a string → detect handler time conflict → resolve it

---

## ✅ Sprint Status: ALL FEATURES SHIPPED

| Epic | Status | Key Deliverable |
|------|--------|----------------|
| Public Results Page | ✅ Done | `/shows/[id]/results` — no-auth, shareable, NAMHSA badge |
| Platform-Verified Records | ✅ Done | 3-tier trust badges on all show records |
| NAN Card Polish | ✅ Done | 4-year expiry, NAN CSV export, partnership language |
| Regions + Sanctioning | ✅ Done | 11 NAMHSA regions, sanctioning toggle, badge on listings |
| Judge COI Checker | ✅ Done | 3-condition conflict detection, advisory warnings |

**Remaining before meeting:** Manual QA walkthrough of the demo script above.

---

## What We Will Never Do

- ❌ Replace NAMHSA's governance, voting, or membership system
- ❌ Issue official NAN cards (we only track digital bookkeeping)
- ❌ Charge NAMHSA or its members for basic show features
- ❌ Claim to be "the official NAMHSA platform"
- ❌ Train AI on user data or show records
- ❌ Lock data in — everything is exportable as CSV

---

## Trust Architecture

| Trust Tier | Badge | Source | Forgeable? |
|-----------|-------|--------|-----------|
| 📝 Self-Reported | *Self-Reported* | User typed it in manually | Yes — no verification |
| ✅ Host Verified | *Host Verified* | Judge/admin clicked "Verify" | Low — human attestation |
| 🛡️ MHH Verified | *MHH Verified* | MHH competition engine finalized results | **No** — full digital chain |

**Key pitch point:** "When a show is hosted on MHH, every record has a complete chain: entry → judging → placement. That chain is immutable. NAMHSA can trust these records because they can't be forged after the fact."

---

## Revenue Model (Not NAMHSA's Problem)

MHH is a freemium platform. Basic showing features are **free forever**. Premium features (Pro subscriptions, promoted listings, AI analysis) fund the platform. We will never gate NAMHSA-essential features behind a paywall.

---

## Contact

Model Horse Hub — modelhorsehub.com
