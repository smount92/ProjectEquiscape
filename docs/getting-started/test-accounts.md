# Test Accounts

## Overview

E2E tests require two test accounts configured in `.env.local`. These accounts simulate a buyer/seller pair for commerce flow testing, ownership transfers, and social interactions.

## Setup

### 1. Create Test Accounts in Supabase

1. Open your Supabase Dashboard → Authentication → Users
2. Create two test users with email/password auth
3. Confirm their email addresses (or disable email confirmation for the test project)

### 2. Configure `.env.local`

Add the following variables to `.env.local` (this file is gitignored):

```env
# Test Account A — acts as seller/owner in E2E tests
TEST_USER_A_EMAIL=<your-test-email-a>
TEST_USER_A_PASSWORD=<your-test-password-a>

# Test Account B — acts as buyer/recipient in E2E tests
TEST_USER_B_EMAIL=<your-test-email-b>
TEST_USER_B_PASSWORD=<your-test-password-b>
```

> ⚠️ **Never commit actual credentials.** The `.env.local` file is in `.gitignore`. Only variable names appear in documentation.

### 3. Test Account Roles

| Account | Role in Tests | Used For |
|---------|---------------|----------|
| **User A** | Seller / Owner | Listing horses for sale, accepting offers, initiating transfers, creating shows |
| **User B** | Buyer / Recipient | Making offers, claiming transfers, entering shows, following User A |

### 4. Hiding Test Accounts

Migration `086_hide_test_accounts.sql` provides a mechanism to hide test accounts from public pages (Discover, Show Ring, etc.) so they don't appear to real beta users.

## Running E2E Tests

```bash
# Start the dev server first
npm run dev

# In another terminal, run E2E tests
npm run test:e2e
```

E2E tests use Playwright with headless Chromium. See [Testing Guide](../guides/testing.md) for full details.

## Test Specs

| Spec File | What It Tests |
|-----------|---------------|
| `smoke.spec.ts` | Basic page load (landing, login, signup, community) |
| `auth.spec.ts` | Login flow with test credentials |
| `inventory.spec.ts` | Add/view horse CRUD |
| `safe-trade.spec.ts` | Commerce state machine (offer → accept → pay → verify) |
| `hoofprint-transfer.spec.ts` | Ownership transfer (generate PIN → claim) |
| `show-entry.spec.ts` | Show entry submission |
| `accessibility.spec.ts` | axe-core WCAG 2.1 AA audits |

---

**Next:** [Setup](setup.md) · [Project Structure](project-structure.md)
