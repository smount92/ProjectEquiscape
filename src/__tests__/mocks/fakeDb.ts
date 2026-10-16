/**
 * A small table-aware Supabase stand-in for action tests that touch more
 * than one table. Every query is recorded; a responder per table decides
 * what each query returns.
 *
 *   const db = fakeDb();
 *   db.on("posts", (q) => (q.op === "select" ? { data: [{ id: "p1" }], error: null } : OK));
 *   ...
 *   expect(db.writes("posts")[0].payload).toEqual({ hidden_at: expect.any(String) });
 */

export interface FakeQuery {
    table: string;
    op: "select" | "insert" | "update" | "delete" | "upsert";
    payload?: unknown;
    columns?: string;
    /** [method, ...args], e.g. ["eq", "id", "x"] or ["in", "id", ["a"]]. */
    filters: unknown[][];
}

export interface FakeResult {
    data: unknown;
    error: unknown;
}

export const OK: FakeResult = { data: null, error: null };

const FILTERS = [
    "eq",
    "neq",
    "in",
    "is",
    "or",
    "order",
    "limit",
    "like",
    "ilike",
    "not",
    "gte",
    "lte",
    "gt",
    "lt",
    "range",
];

export function fakeDb() {
    const queries: FakeQuery[] = [];
    const responders = new Map<string, (q: FakeQuery) => FakeResult>();

    function from(table: string) {
        const q: FakeQuery = { table, op: "select", filters: [] };
        let started = false;
        const chain: Record<string, unknown> = {};
        for (const op of ["select", "insert", "update", "delete", "upsert"] as const) {
            chain[op] = (...args: unknown[]) => {
                // .update(...).select("id") keeps the update; a select after a
                // write only asks for rows back.
                if (op === "select" && started) return chain;
                started = true;
                q.op = op;
                if (op === "select") q.columns = args[0] as string;
                else q.payload = args[0];
                return chain;
            };
        }
        for (const f of FILTERS) {
            chain[f] = (...args: unknown[]) => {
                q.filters.push([f, ...args]);
                return chain;
            };
        }
        const resolve = (): FakeResult => {
            queries.push(q);
            return responders.get(table)?.(q) ?? OK;
        };
        chain.single = async () => resolve();
        chain.maybeSingle = async () => resolve();
        chain.then = (onOk: (v: FakeResult) => unknown, onErr?: (e: unknown) => unknown) =>
            Promise.resolve(resolve()).then(onOk, onErr);
        return chain;
    }

    return {
        from,
        queries,
        /** Decide what queries on `table` return. */
        on(table: string, responder: (q: FakeQuery) => FakeResult) {
            responders.set(table, responder);
        },
        /** Insert / update / delete / upsert queries on a table, in order. */
        writes(table: string): FakeQuery[] {
            return queries.filter((q) => q.table === table && q.op !== "select");
        },
        /** The value a filter was given, e.g. filter(q, "eq", "id"). */
        filter(q: FakeQuery, method: string, column: string): unknown {
            return q.filters.find((f) => f[0] === method && f[1] === column)?.[2];
        },
        reset() {
            queries.length = 0;
            responders.clear();
        },
    };
}

export type FakeDb = ReturnType<typeof fakeDb>;
