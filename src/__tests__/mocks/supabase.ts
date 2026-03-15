import { vi } from "vitest";

/**
 * Creates a mock Supabase client for unit/integration tests.
 * Chain methods return `this` for fluent API compatibility.
 *
 * Usage:
 *   const mock = createMockSupabaseClient();
 *   mock._mockQuery.select.mockResolvedValueOnce({ data: [...], error: null });
 */
export function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: undefined, // Prevent auto-await
        data: null,
        error: null,
        ...overrides,
    };

    return {
        from: vi.fn(() => mockQuery),
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: "test-user-id", email: "test@example.com" } },
            }),
            signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
            signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        },
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn().mockResolvedValue({ data: { path: "test/path.webp" }, error: null }),
                remove: vi.fn().mockResolvedValue({ data: [], error: null }),
                getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.supabase.co/storage/v1/object/public/horse-images/test/path.webp" } }),
            })),
        },
        _mockQuery: mockQuery, // Expose for per-test assertions
    };
}

/**
 * Creates a mock admin client (bypasses RLS).
 * Same interface as above but represents the service-role client.
 * Used in tests for cross-user operations (notifications, transfers, etc.)
 */
export function createMockAdminClient(overrides: Record<string, unknown> = {}) {
    const client = createMockSupabaseClient(overrides);
    // Admin client is identical in shape — the difference is RLS bypass,
    // which doesn't apply in mocked tests. This function exists so tests
    // can mock `getAdminClient()` with a semantically-correct factory.
    return client;
}
