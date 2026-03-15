Comprehensive Testing Suite Blueprint for Model Horse Hub
Date: March 15, 2026
Architect Agent Directive: This blueprint outlines a thorough, enterprise-grade testing strategy for the Model Horse Hub codebase. It prioritizes correctness, coverage, and maintainability over speed. The suite will include unit, integration, end-to-end (E2E), performance, and security tests. Implementation will be phased to avoid overwhelming the codebase. Use Vitest for unit/integration (compatible with Next.js), Playwright for E2E, and additional tools for specialized testing. Assume no existing tests beyond the scaffold in src/__tests__/smoke.test.ts; build from there.
Prerequisites:
Install required dependencies: npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright supabase/js @supabase/supabase-js msw (for mocking).
Configure vitest.config.ts to include React support (via @vitejs/plugin-react), coverage thresholds (aim for 80%+), and setup files for global mocks.
Set up Playwright with npx playwright install --with-deps.
Create a test database in Supabase (e.g., local or staging) for integration tests; use environment variables to switch contexts.
Rules: Tests must be deterministic (mock dates, UUIDs, etc.). UseArrange-Act-Assert pattern. Isolate tests with mocks (MSW for API, Supabase mocks for DB). Run in CI (Vercel/GitHub Actions). Document each test file with coverage reports.
// turbo-all

Phase 1: Setup and Configuration (Foundation for All Tests)
Task 1.1: Configure Vitest for Unit and Integration Tests

Create vitest.config.ts in root: Extend Next.js config, enable coverage with V8, set thresholds (branches: 80%, functions: 80%, lines: 80%, statements: 80%). Include setup file setupTests.ts for extending expect with jest-dom.
Add global mocks: Mock next/navigation (useRouter, usePathname), mock Supabase client (use @supabase/supabase-js to create mock client with jest.fn() for auth/query/storage).
Set up MSW (Mock Service Worker) for server actions: In setupTests.ts, initialize MSW handlers to mock all /app/actions/* imports.

Task 1.2: Configure Playwright for E2E Tests

Run npx playwright init to generate playwright.config.ts: Set projects for Chromium, Firefox, WebKit; enable tracing, screenshots on failure, and video recording. Use baseURL from env (e.g., http://localhost:3000).
Create tests/e2e/helpers.ts: Utility functions for authentication (programmatic login via Supabase auth), data seeding (insert test users/horses via admin client), and cleanup (truncate tables post-test).
Integrate with Supabase: Use a test project key; ensure RLS is enabled in tests to catch policy violations.

Task 1.3: CI/CD Integration

Add scripts to package.json: "test:unit": "vitest --coverage", "test:e2e": "playwright test", "test:all": "npm run test:unit && npm run test:e2e".
Configure Vercel/GitHub Actions workflow: Run test:all on push/PR; upload coverage reports as artifacts. Fail builds below coverage thresholds.

Task 1.4: Mocking Strategy

Database Mocks: Use supabase-mock or manual jest.fn() on createClient to return predefined data for queries/inserts.
External Services: Mock Resend (email), @react-pdf/renderer (PDF gen), fuzzysort (search). Use nock or MSW for API routes (e.g., /api/cron/*).
Auth Mocks: Provide mock user sessions with varying roles (user, admin, artist).

Phase 2: Unit Tests (Isolated Component and Function Testing)
Task 2.1: Test Client Components (94 Components)

Group by category (e.g., src/components/__tests__/social/LikeToggle.test.tsx).
For each: Render with RTL, test props handling, state changes (useUserEvent for interactions), snapshot if UI-stable.
Priority: Core UI (Header.tsx, DashboardShell.tsx – test ResizeObserver logic), Commerce (MakeOfferModal.tsx – form validation, submission), Social (ChatThread.tsx – render messages, guardrails), Provenance (HoofprintTimeline.tsx – timeline rendering from mock data).
Coverage: 100% for pure functions (e.g., utils/imageCompression.ts), 90% for components.

Task 2.2: Test Utils and Lib Functions

Directory: src/lib/__tests__/*.
Test: imageCompression.ts (edge cases: large images, invalid formats), mentions.ts (parsing with spaces), rateLimit.ts (throttling logic), storage.ts (signed URL generation), validation.ts (schema checks).
Use parameterized tests (Vitest's it.each) for inputs/outputs.

Task 2.3: Test PDF Components

src/components/pdf/__tests__/*: Mock data, render CertificateOfAuthenticity.tsx/InsuranceReport.tsx, assert generated PDF structure (use @react-pdf/renderer mocks to capture output).

Phase 3: Integration Tests (Data Flow and Server Actions)
Task 3.1: Test Server Actions (35 Files)

Directory: src/app/actions/__tests__/* (e.g., horse.test.ts).
For each action: Mock Supabase client, test happy paths (success: true, data), error paths (auth fail, validation fail, DB errors), edge cases (concurrent updates, rate limits).
Priority: Critical domains – transactions.ts (state machine transitions, prevent invalid states), horse.ts (CRUD with image handling), competition.ts (event hierarchy integrity), art-studio.ts (commission lifecycle).
Use MSW to mock after() background tasks (notifications).
Database Integration: For key actions, use real Supabase test DB (seed/cleanup in beforeEach/afterEach) to verify RLS, constraints, and side effects (e.g., activity events).

Task 3.2: Test API Routes (5 Routes)

src/app/api/__tests__/*: Mock requests with supertest or Vitest's fetch mock. Test auth callback (PKCE flow), cron refresh (view refresh), export (PDF output), identify-mold (image analysis), reference-dictionary (search).

Task 3.3: Test Data Migrations and Schema Integrity

Use Supabase CLI to spin up local DB, apply all 73 migrations sequentially, assert no errors.
Write schema tests: Query table structures post-migration, verify RLS policies (attempt unauthorized access), indexes, constraints.

Phase 4: End-to-End Tests (User Flows)
Task 4.1: Core User Flows

Directory: tests/e2e/* (e.g., auth.spec.ts).
Auth: Signup, login, password reset, session persistence.
Inventory: Add horse (multi-step form, reference search, image upload/crop), edit, delete (tombstone), CSV import.
Social: Post creation, like/comment, DM with offer, block user (verify isolation).
Commerce: Make offer, accept/decline, complete transaction, leave rating.
Competition: Create event/show, enter horse, assign judges, place results, auto-generate records.
Art Studio: Setup profile, request commission, update WIP, complete and transfer.
Groups: Create group, add members, post/file upload, admin moderation.

Task 4.2: Edge and Accessibility Flows

Simple Mode: Toggle, verify font scaling, button sizes.
Performance: Multi-horse stable (100+), infinite scroll feed.
Error States: Network failures (use Playwright's offline mode), invalid inputs, RLS violations.
Accessibility: Use axe-core integration in Playwright to check ARIA, keyboard nav.

Task 4.3: Cross-Browser and Device Testing

Run on all projects (desktop/mobile viewports).
Test responsive breakpoints (e.g., header collapse on mobile).

Phase 5: Specialized Tests (Performance, Security, Load)
Task 5.1: Performance Tests

Use Vitest benchmarks for critical functions (e.g., fuzzy search on 10K catalog).
Playwright: Measure page load times, timeline query perf (for long histories).
Set baselines: <500ms for server actions, <2s for E2E page interactions.

Task 5.2: Security Tests

Use OWASP ZAP or manual: Scan for XSS (in posts/RichText.tsx), CSRF (server actions use Next.js built-in), SQL injection (though Supabase mitigates).
Auth Tests: Token expiration, session hijacking attempts.
RLS Fuzzing: Attempt cross-user data access in integration tests.

Task 5.3: Load Tests

Use k6 or Artillery: Simulate 100 concurrent users on feed/market pages.
Database: Stress test materialized views with high-volume inserts.

Phase 6: Reporting and Maintenance
Task 6.1: Coverage and Reporting

Generate reports: Vitest coverage HTML, Playwright HTML reporter.
Add badges to README.md (coverage %).

Task 6.2: Test Documentation and Hooks

Each test file: JSDoc for purpose, edge cases covered.
Git Hooks: Husky for pre-commit lint/test.

Task 6.3: Ongoing Maintenance Plan

Review: After each feature, add/update tests.
Refactor: If coverage dips below 80%, prioritize in next sprint.

Expected Timeline: 4-6 weeks for full implementation, depending on team size. Run test:all weekly to monitor. This suite ensures the platform's longevity and reliability for hobby-scale growth.