/**
 * Component test setup — extends Vitest with jest-dom matchers
 * and provides common mocks for Next.js and Supabase.
 */

import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock Next.js navigation
// Route handlers reach for Sentry only on their failure path, via
// `await import("@sentry/nextjs")` — right for production (nothing loads
// on the hot path), but in a test that import pulls in the whole SDK and
// took 10–12 s under load, tripping the timeout on the PayPal "API fails"
// tests every time the machine was busy (2026-09-19). A test file that
// needs the real shape can still vi.mock it itself.
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    withScope: (cb: (scope: unknown) => void) => cb({ setTag: vi.fn(), setExtra: vi.fn(), setUser: vi.fn() }),
    startSpan: (_opts: unknown, cb: () => unknown) => cb(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    return vi.fn().mockImplementation(() => null)("a", { href, ...props }, children);
  },
}));

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/test.jpg" } }),
      }),
    },
  }),
}));

// Mock Supabase server
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));
