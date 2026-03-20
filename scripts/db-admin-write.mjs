#!/usr/bin/env node

/**
 * db-admin-write.mjs — Supabase WRITE utility (requires explicit user approval)
 * 
 * ⚠️  THIS SCRIPT CAN MODIFY DATA. Never auto-run.
 * 
 * Usage:
 *   node scripts/db-admin-write.mjs delete <table> <column>=<value>
 *   node scripts/db-admin-write.mjs update <table> <set_column>=<value> <where_column>=<value>
 *   node scripts/db-admin-write.mjs insert <table> '{"key":"value"}'
 * 
 * Examples:
 *   node scripts/db-admin-write.mjs delete user_horses "custom_name=Test Horse Bug"
 *   node scripts/db-admin-write.mjs update events "show_status=closed" "id=abc-123"
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

const [,, command, ...args] = process.argv;

function parseFilter(filterStr) {
    const eqIdx = filterStr.indexOf("=");
    if (eqIdx === -1) throw new Error(`Invalid filter: ${filterStr}. Use column=value`);
    return [filterStr.slice(0, eqIdx).trim(), filterStr.slice(eqIdx + 1).trim()];
}

async function deleteRows(table, filterStr) {
    const [col, val] = parseFilter(filterStr);

    // Preview what will be deleted
    const { data: preview, error: previewErr } = await supabase
        .from(table)
        .select("*")
        .eq(col, val);

    if (previewErr) {
        console.error(`❌ Preview error: ${previewErr.message}`);
        return;
    }

    console.log(`\n🗑️  Will DELETE from "${table}" where ${col} = "${val}":`);
    console.log(`   Found ${preview?.length ?? 0} matching rows:\n`);

    if (preview && preview.length > 0) {
        console.table(preview);
    } else {
        console.log("   (no matching rows — nothing to delete)");
        return;
    }

    // Actually delete
    const { error } = await supabase
        .from(table)
        .delete()
        .eq(col, val);

    if (error) {
        console.error(`\n❌ Delete failed: ${error.message}`);
    } else {
        console.log(`\n✅ Deleted ${preview.length} rows from "${table}".`);
    }
}

async function updateRows(table, setStr, filterStr) {
    const [setCol, setVal] = parseFilter(setStr);
    const [whereCol, whereVal] = parseFilter(filterStr);

    // Preview
    const { data: preview } = await supabase
        .from(table)
        .select("*")
        .eq(whereCol, whereVal);

    console.log(`\n✏️  Will UPDATE "${table}" SET ${setCol} = "${setVal}" WHERE ${whereCol} = "${whereVal}":`);
    console.log(`   Found ${preview?.length ?? 0} matching rows:\n`);

    if (preview && preview.length > 0) {
        console.table(preview);
    } else {
        console.log("   (no matching rows — nothing to update)");
        return;
    }

    const { error } = await supabase
        .from(table)
        .update({ [setCol]: setVal })
        .eq(whereCol, whereVal);

    if (error) {
        console.error(`\n❌ Update failed: ${error.message}`);
    } else {
        console.log(`\n✅ Updated ${preview.length} rows in "${table}".`);
    }
}

async function insertRow(table, jsonStr) {
    let row;
    try {
        row = JSON.parse(jsonStr);
    } catch {
        console.error("❌ Invalid JSON:", jsonStr);
        return;
    }

    console.log(`\n➕ Will INSERT into "${table}":`);
    console.table([row]);

    const { data, error } = await supabase.from(table).insert(row).select();

    if (error) {
        console.error(`\n❌ Insert failed: ${error.message}`);
    } else {
        console.log(`\n✅ Inserted 1 row into "${table}":`);
        console.table(data);
    }
}

// ── Main ──
switch (command) {
    case "delete":
        if (args.length < 2) { console.error('Usage: db-admin-write.mjs delete <table> "column=value"'); break; }
        await deleteRows(args[0], args[1]);
        break;

    case "update":
        if (args.length < 3) { console.error('Usage: db-admin-write.mjs update <table> "set_col=val" "where_col=val"'); break; }
        await updateRows(args[0], args[1], args[2]);
        break;

    case "insert":
        if (args.length < 2) { console.error('Usage: db-admin-write.mjs insert <table> \'{"key":"value"}\''); break; }
        await insertRow(args[0], args[1]);
        break;

    default:
        console.log(`
⚠️  db-admin-write.mjs — Supabase WRITE Utility

THIS SCRIPT MODIFIES DATA. Each command previews affected rows before executing.

Commands:
  delete <table> "column=value"                       Delete matching rows
  update <table> "set_col=val" "where_col=val"        Update matching rows
  insert <table> '{"key":"value"}'                    Insert a new row

Examples:
  node scripts/db-admin-write.mjs delete user_horses "custom_name=Test Horse Bug"
  node scripts/db-admin-write.mjs update events "show_status=closed" "id=abc-123"
  node scripts/db-admin-write.mjs insert badges '{"name":"test","description":"test badge"}'
`);
}
