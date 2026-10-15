---
name: feature-request
description: Use when a member or the owner asks for something new or different - "it would be great if", "can we add", "why doesn't it" - or when a bug turns out to be a missing feature.
---

# Take a feature request from idea to decision

Ideas are cheap to collect and expensive to build. Capture every one; build
only what the owner decides.

## Steps

1. **Capture**: a Roadmap item (Admin › Roadmap) with the member's exact words, who asked, and the link. Several members asking for the same thing go on one item.
2. **Find the real need**: what were they trying to do when they asked? (Members put serial numbers into horse names because the Registry hid the numbers; the fix was the display, not a new field.)
3. **Check the decisions** in `docs/DECISIONS.md`. Does the idea contradict one (never hold money, trust never paywalled, record not referee, Registry first)? Say so.
4. **Design before code** for anything members will see: a short spec, a mock or prototype, the open questions as a numbered list with a recommendation each. The owner and the design lead approve the look.
5. **Opt-in first** for big changes: ship behind a "Try the new ..." switch or a flag, test with real members, then make it the default and delete the old path and the flag.
6. **Record the decision** in `docs/DECISIONS.md` when the owner makes it.
