/**
 * A small in-memory stand-in for the Supabase client, enough for the
 * Registry writer's tests: select / insert / update / upsert / delete with
 * eq, neq, in, is, ilike, limit, single, maybeSingle and head counts, plus
 * rpc handlers. Tables can be marked missing (an unpasted migration) and
 * columns can be refused (a column a migration has not added yet).
 */

type Row = Record<string, unknown>;
type Result = {
    data: unknown;
    error: { code?: string; message?: string; details?: string } | null;
    count?: number | null;
};

let seq = 0;
export function fakeId(): string {
    seq += 1;
    const hex = seq.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
}

export interface FakeDb {
    tables: Record<string, Row[]>;
    /** Tables that do not exist yet (PGRST205). */
    missing: Set<string>;
    /** Columns a table refuses (PGRST204), e.g. catalog_changelog.actor_role before 242. */
    missingColumns: Record<string, string[]>;
    rpcs: Record<string, (args: Record<string, unknown>) => Result | Promise<Result>>;
    /** Every write, in order. */
    log: { table: string; op: string; payload?: unknown; filters?: string[] }[];
    /** Make the next update of a table match nothing (a lost race). */
    loseNextUpdate: Set<string>;
    client: {
        from: (table: string) => Query;
        rpc: (name: string, args?: Record<string, unknown>) => Promise<Result>;
    };
}

function likeToRegex(pattern: string): RegExp {
    const escaped = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
    return new RegExp(`^${escaped}$`, "is");
}

class Query implements PromiseLike<Result> {
    private op: "select" | "update" | "insert" | "upsert" | "delete" | null = null;
    private filters: ((r: Row) => boolean)[] = [];
    private filterText: string[] = [];
    private payload: unknown = null;
    private conflict: string[] = [];
    private returning = false;
    private head = false;
    private wantCount = false;
    private mode: "many" | "single" | "maybe" = "many";
    private max = Infinity;

    constructor(
        private db: FakeDb,
        private table: string,
    ) {}

    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (this.op === null) this.op = "select";
        else this.returning = true;
        if (opts?.head) this.head = true;
        if (opts?.count) this.wantCount = true;
        return this;
    }
    insert(rows: unknown) {
        this.op = "insert";
        this.payload = rows;
        return this;
    }
    upsert(rows: unknown, opts?: { onConflict?: string }) {
        this.op = "upsert";
        this.payload = rows;
        this.conflict = (opts?.onConflict ?? "id").split(",").map((s) => s.trim());
        return this;
    }
    update(row: unknown) {
        this.op = "update";
        this.payload = row;
        return this;
    }
    delete() {
        this.op = "delete";
        return this;
    }
    eq(col: string, val: unknown) {
        this.filters.push((r) => r[col] === val);
        this.filterText.push(`${col}=${String(val)}`);
        return this;
    }
    neq(col: string, val: unknown) {
        this.filters.push((r) => r[col] !== null && r[col] !== undefined && r[col] !== val);
        return this;
    }
    in(col: string, vals: unknown[]) {
        this.filters.push((r) => vals.includes(r[col]));
        return this;
    }
    is(col: string, val: unknown) {
        this.filters.push((r) => (r[col] ?? null) === val);
        return this;
    }
    ilike(col: string, pattern: string) {
        const re = likeToRegex(pattern);
        this.filters.push((r) => typeof r[col] === "string" && re.test(r[col] as string));
        return this;
    }
    order() {
        return this;
    }
    limit(n: number) {
        this.max = n;
        return this;
    }
    single() {
        this.mode = "single";
        return this;
    }
    maybeSingle() {
        this.mode = "maybe";
        return this;
    }

    then<A = Result, B = never>(
        onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
        onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
        return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }

    private shape(rows: Row[]): Result {
        if (this.mode === "single")
            return rows[0]
                ? { data: rows[0], error: null }
                : { data: null, error: { code: "PGRST116", message: "no rows" } };
        if (this.mode === "maybe") return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
    }

    private run(): Result {
        const db = this.db;
        if (db.missing.has(this.table))
            return { data: null, error: { code: "PGRST205", message: `missing table ${this.table}` } };
        const rows = (db.tables[this.table] ??= []);
        const match = (r: Row) => this.filters.every((f) => f(r));
        const refused = (obj: Row) => (db.missingColumns[this.table] ?? []).find((c) => c in obj);

        if (this.op === "select") {
            const found = rows.filter(match).slice(0, this.max);
            if (this.head) return { data: null, error: null, count: found.length };
            const result = this.shape(found.map((r) => ({ ...r })));
            if (this.wantCount) result.count = found.length;
            return result;
        }
        if (this.op === "insert" || this.op === "upsert") {
            const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
            for (const r of list) {
                const bad = refused(r);
                if (bad) return { data: null, error: { code: "PGRST204", message: `no column ${bad}` } };
            }
            db.log.push({ table: this.table, op: this.op, payload: this.payload });
            const out: Row[] = [];
            for (const r of list) {
                if (this.op === "upsert") {
                    const existing = rows.find((x) => this.conflict.every((k) => x[k] === r[k]));
                    if (existing) {
                        Object.assign(existing, r);
                        out.push({ ...existing });
                        continue;
                    }
                }
                const now = new Date().toISOString();
                const row: Row = { id: fakeId(), created_at: now, ...r };
                if (this.table === "catalog_items" && !("updated_at" in row)) row.updated_at = now;
                rows.push(row);
                out.push({ ...row });
            }
            return this.returning ? this.shape(out) : { data: null, error: null };
        }
        if (this.op === "update") {
            const bad = refused(this.payload as Row);
            if (bad) return { data: null, error: { code: "PGRST204", message: `no column ${bad}` } };
            db.log.push({ table: this.table, op: "update", payload: this.payload, filters: this.filterText });
            let hit = rows.filter(match);
            if (db.loseNextUpdate.has(this.table)) {
                db.loseNextUpdate.delete(this.table);
                hit = [];
            }
            for (const r of hit) {
                Object.assign(r, this.payload as Row);
                if (this.table === "catalog_items") r.updated_at = `t-${fakeId()}`;
            }
            return this.returning ? this.shape(hit.map((r) => ({ ...r }))) : { data: null, error: null };
        }
        if (this.op === "delete") {
            db.log.push({ table: this.table, op: "delete", filters: this.filterText });
            db.tables[this.table] = rows.filter((r) => !match(r));
            return { data: null, error: null };
        }
        return { data: null, error: null };
    }
}

export function createFakeDb(): FakeDb {
    const db: FakeDb = {
        tables: {},
        missing: new Set(),
        missingColumns: {},
        rpcs: {},
        log: [],
        loseNextUpdate: new Set(),
        client: {
            from: (table: string) => new Query(db, table),
            rpc: async (name: string, args: Record<string, unknown> = {}) => {
                const handler = db.rpcs[name];
                if (!handler) return { data: null, error: { code: "PGRST202", message: `no function ${name}` } };
                db.log.push({ table: `rpc:${name}`, op: "rpc", payload: args });
                return handler(args);
            },
        },
    };
    return db;
}

/** A Registry row with sensible defaults. */
export function catalogRow(over: Row = {}): Row {
    return {
        id: fakeId(),
        item_type: "plastic_release",
        parent_id: null,
        title: "Adios",
        maker: "Breyer",
        maker_slug: "breyer",
        slug: "adios",
        scale: "Traditional (1:9)",
        attributes: {},
        artist: null,
        manufacturer: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...over,
    };
}
