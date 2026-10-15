---
name: investigate-bug
description: Use when something on the site does not work, errors, shows the wrong thing, can't be found, or looks broken - from a member report, an error digest, or something noticed while working. Reproduce, find the cause, fix it with a test that would have caught it, verify, reply.
---

# Investigate a bug

Never fix what you have not reproduced. Never call it fixed until the
member's exact case passes.

## 1. Reproduce

- Use the member's own links and words. Read the rows they point at (anon REST reads; `.env.local` has the public key).
- Reproduce on **every surface that shows the same thing**. Registry example: old picker, new linker, `/catalog` search, the reference page, the passport. A bug on one surface and not another tells you where the cause is.
- Logged-out problems: check production directly. Logged-in problems: a look-see (below) as the test bot on the dev server.
- Error digest from the error page: find it in Admin › Ops › Errors (Sentry). Vercel logs hold `console` output.
- If you cannot reproduce, say so and ask the member for one more detail. Do not guess-fix.

## 2. Find the cause, not the symptom

Ask in order: **is it the data, the search, the display, or the action that saves it?**

- Data: the row really is wrong → `registry-data-fix` or a repair script.
- Search/read: the row is right but the query misses it (filters, the 1,000-row cap, `or()` syntax, a cache key that was not bumped).
- Display: the row is found but rendered wrong or hidden.
- Write: the action saved the wrong thing. **Check what else that action wrote** - a bad write is never just one row.

Then count: how many other rows, horses or members hit the same cause? Report that number.

If several places decide the same thing differently, that is the bug. Build one owner (see `docs/DECISIONS.md`, single owner) instead of patching each place.

## 3. Fix with a test first

1. Write the test that fails for the member's case (vitest, next to the module in `__tests__/`).
2. Fix the code. The test passes.
3. Run the whole suite; the pre-commit hook runs it again.
4. If the fix changes what a cached page shows, bump the cache key or tag.
5. If bad data already exists, write a repair (see `registry-data-fix` for the pattern); a code fix does not repair rows already written.

## 4. Verify

- Look-see: a throwaway `e2e/zz-look.config.ts` + `zz-look.spec.ts` against the dev server on :3939, logged in as the test bot. Walk the member's exact path, screenshot, then **delete the zz-look files** before committing.
- Logged-out pages: check production after deploy.
- Mobile: if the member was on a phone, check at 375 px.

## 5. Ship and close

- Commit message: the member-visible symptom first, then the cause.
- Pushing to main deploys. Batch pushes unless the bug blocks members.
- Draft the reply to the member (see `member-report` step 4).

## Traps we have hit

- Supabase returns at most 1,000 rows. Page every read that could exceed it.
- PostgREST `or()`: wildcard is `*`, no spaces, no `%`.
- `unstable_cache` serves old data for up to an hour; a fix may look broken until the key changes.
- A UI that shows a row under a different parent than its own must not let the member edit it there.
- On this low-memory machine a failing test file can be a memory fault. Re-run that file alone before believing it.
