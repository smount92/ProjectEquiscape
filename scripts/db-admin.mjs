#!/usr/bin/env node

/**
 * db-admin.mjs — Read-only Supabase query utility
 * 
 * Usage:
 *   node scripts/db-admin.mjs query "SELECT count(*) FROM user_horses"
 *   node scripts/db-admin.mjs tables
 *   node scripts/db-admin.mjs describe <table_name>
 *   node scripts/db-admin.mjs count <table_name>
 * 
 * ⚠️  SAFETY: This script is READ-ONLY. It rejects INSERT, UPDATE, DELETE, 
 *    DROP, ALTER, TRUNCATE, and CREATE statements.
 *    Use db-admin-write.mjs for write operations (requires explicit approval).
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ──
function loadEnv() {
    try {
        const envContent = readFileSync(".env.local", "utf-8");
        for (const line of envContent.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) process.env[key] = value;
        }
    } catch {
        console.error("❌ Could not read .env.local — run from project root");
        process.exit(1);
    }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ── Safety check — block write operations ──
const WRITE_PATTERNS = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|UPSERT)\b/i;

function isWriteQuery(sql) {
    return WRITE_PATTERNS.test(sql);
}

// ── Commands ──
const [,, command, ...args] = process.argv;

async function runQuery(sql) {
    if (isWriteQuery(sql)) {
        console.error("🛑 BLOCKED: Write operation detected. This script is READ-ONLY.");
        console.error("   Query:", sql.slice(0, 100));
        console.error("   Use db-admin-write.mjs for write operations.");
        process.exit(1);
    }

    console.log(`\n📊 Running: ${sql.slice(0, 200)}${sql.length > 200 ? "..." : ""}\n`);

    const { data, error } = await supabase.rpc("", {}).throwOnError === undefined
        ? { data: null, error: { message: "RPC not available" } }
        : { data: null, error: null };

    // Use the REST API to run raw SQL via postgrest
    // Since Supabase JS client doesn't support raw SQL, we use fetch
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
        },
    });

    // Fallback: use the Supabase client's from() for table queries
    console.error("ℹ️  Raw SQL not available via REST API. Use table-based queries instead.");
    console.error("   Try: node scripts/db-admin.mjs from <table> [select] [filter]");
}

async function listTables() {
    console.log("\n📋 Public tables:\n");
    // Query information_schema via a known table
    const tables = [
        "users", "user_horses", "horse_images", "catalog_horses",
        "conversations", "messages", "notifications", "user_follows",
        "events", "event_entries", "event_divisions", "event_classes",
        "event_judges", "event_votes", "show_records",
        "posts", "likes", "media_attachments",
        "collections", "collection_items",
        "favorites", "user_ratings", "horse_pedigree",
        "artist_profiles", "commissions", "artist_resins",
        "user_badges", "badges", "activity_events",
        "offers", "catalog_suggestions", "help_requests",
        "transfer_codes",
    ];

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });

        if (error) {
            console.log(`  ❌ ${table.padEnd(25)} — ${error.message}`);
        } else {
            console.log(`  ✅ ${table.padEnd(25)} ${String(count ?? 0).padStart(6)} rows`);
        }
    }
    console.log();
}

async function describeTable(tableName) {
    console.log(`\n📋 First 5 rows of "${tableName}":\n`);

    const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .limit(5);

    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
    }

    if (!data || data.length === 0) {
        console.log("  (empty table)");
        return;
    }

    // Show columns
    const cols = Object.keys(data[0]);
    console.log(`  Columns (${cols.length}): ${cols.join(", ")}\n`);
    console.table(data);
}

async function countTable(tableName) {
    const { count, error } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
    }

    console.log(`\n📊 ${tableName}: ${count} rows\n`);
}

async function fromTable(tableName, selectCols, filterStr) {
    const select = selectCols || "*";
    console.log(`\n📊 SELECT ${select} FROM ${tableName}${filterStr ? ` WHERE ${filterStr}` : ""} LIMIT 25\n`);

    let query = supabase.from(tableName).select(select).limit(25);

    // Parse simple filters like "column=value" or "column.eq.value"
    if (filterStr) {
        const parts = filterStr.split(",");
        for (const part of parts) {
            // Support: column=value (eq shorthand)
            if (part.includes("=") && !part.includes(".")) {
                const [col, val] = part.split("=");
                query = query.eq(col.trim(), val.trim());
            }
            // Support: column.is.null
            else if (part.includes(".is.null")) {
                const col = part.split(".is.null")[0].trim();
                query = query.is(col, null);
            }
            // Support: column.neq.value
            else if (part.includes(".neq.")) {
                const [col, val] = part.split(".neq.");
                query = query.neq(col.trim(), val.trim());
            }
            // Support: column.ilike.%value%
            else if (part.includes(".ilike.")) {
                const [col, val] = part.split(".ilike.");
                query = query.ilike(col.trim(), val.trim());
            }
            // Support: column.in.(val1,val2)
            else if (part.includes(".in.")) {
                const [col, valStr] = part.split(".in.");
                const vals = valStr.replace(/[()]/g, "").split("|");
                query = query.in(col.trim(), vals);
            }
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
    }

    if (!data || data.length === 0) {
        console.log("  (no results)");
        return;
    }

    console.table(data);
    console.log(`  ${data.length} rows returned (limit 25)\n`);
}

// ── Main ──
switch (command) {
    case "tables":
        await listTables();
        break;

    case "describe":
    case "desc":
        if (!args[0]) { console.error("Usage: db-admin.mjs describe <table>"); break; }
        await describeTable(args[0]);
        break;

    case "count":
        if (!args[0]) { console.error("Usage: db-admin.mjs count <table>"); break; }
        await countTable(args[0]);
        break;

    case "from":
        if (!args[0]) { console.error("Usage: db-admin.mjs from <table> [columns] [filters]"); break; }
        await fromTable(args[0], args[1], args[2]);
        break;

    case "query":
        if (!args[0]) { console.error("Usage: db-admin.mjs query \"SELECT ...\""); break; }
        await runQuery(args.join(" "));
        break;

    default:
        console.log(`
🔧 db-admin.mjs — Read-Only Supabase Query Utility

Commands:
  tables                              List all tables with row counts
  describe <table>                    Show first 5 rows + column names
  count <table>                       Count rows in a table
  from <table> [columns] [filters]    Query a table with optional filters

Filter syntax:
  column=value                        Exact match
  column.ilike.%value%                Case-insensitive LIKE
  column.is.null                      IS NULL
  column.neq.value                    Not equal
  column.in.(val1|val2|val3)          IN list (use | as separator)

Examples:
  node scripts/db-admin.mjs tables
  node scripts/db-admin.mjs from user_horses "id,custom_name" "custom_name.ilike.%Test%"
  node scripts/db-admin.mjs from notifications "id,type,content,link_url" "link_url.is.null"
  node scripts/db-admin.mjs count show_records

⚠️  This script is READ-ONLY. Write operations are blocked.
`);
}
