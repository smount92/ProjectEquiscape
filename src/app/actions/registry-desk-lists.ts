"use server";

/**
 * Registry Desk, Package C: the to-do lists, the style rules and History.
 *
 * Every export calls requireRegistryModerator() first: the role is read on
 * every request, so a removed moderator is refused on their next click
 * (a hidden button is not permission). Vetoing and retiring a rule are the
 * owner's alone.
 *
 * The Desk's tables (242 registry_actions, 244 rules, votes, claims) have
 * RLS on and no policies, so after the role check these use the service
 * role. Before 244 is pasted, rules and claims answer PENDING_244; before
 * 242, History answers PENDING_242.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { AuthError, SUSPENDED_AUTH_ERROR, requireRegistryModerator } from "@/lib/auth";
import {
    ACCOUNT_SUSPENDED,
    NOT_LOGGED_IN,
    fail,
    safeError,
    type ActionFailure,
    type ActionResult,
} from "@/lib/actions/result";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { undoAction as undoRegistryAction } from "@/lib/catalog/write";
import { checkRegistryLimit } from "@/lib/registry/limits";
import { actorOf, type ActionKind, type ActionStatus, type ActorRole } from "@/lib/registry/types";
import { TODO_LISTS, type TodoItem, type TodoListDef, type TodoListKey } from "@/lib/registry/checks";
import { FIX_RULES, isKnownFix } from "@/lib/registry/fixes";
import {
    agreementCount,
    canRetire,
    canVeto,
    canWithdraw,
    ruleStatusAfterVote,
    voteProblem,
    type RuleStatus,
    type RuleVote,
    type VoteRow,
} from "@/lib/registry/rules";
import {
    PENDING_242,
    PENDING_244,
    aliasesFor,
    deskDb,
    getCachedTodo,
    isMissingSchema,
    readTodoClaims,
    type TodoClaim,
} from "@/lib/registry/todo";

// ── The role check ──────────────────────────────────────────────

type Moderator = Awaited<ReturnType<typeof requireRegistryModerator>>;

/** The refusal in words: not logged in, suspended, or not a moderator. */
function refused(err: unknown): ActionFailure {
    if (err instanceof AuthError) {
        if (err.message === SUSPENDED_AUTH_ERROR) return fail(ACCOUNT_SUSPENDED);
        if (err.message === "Not authenticated.") return fail(NOT_LOGGED_IN);
        return fail(err.message);
    }
    return safeError("RegistryDeskLists", err);
}

const isRefusal = (x: Moderator | ActionFailure): x is ActionFailure => "success" in x;

/**
 * The Desk's own tables are service-role only (RLS on, no policies); the
 * caller's moderator role has just been checked.
 */
const desk = () => deskDb(getAdminClient());

const TODO_KEYS = TODO_LISTS.map((d) => d.key) as [TodoListKey, ...TodoListKey[]];
const ListKey = z.enum(TODO_KEYS);
const ItemKey = z.string().trim().min(1).max(300);
const Id = z.string().uuid();
const TODO_PAGE = 50;
const DAY_MS = 24 * 3600 * 1000;

// ── To-do lists ─────────────────────────────────────────────────

export interface ClaimView {
    alias: string;
    mine: boolean;
    until: string;
    done: boolean;
}

export interface TodoCard extends TodoListDef {
    count: number;
    /** Claims on single rows of this list that are still open. */
    rowsClaimed: number;
    /** "I'm on it" for the whole list. */
    claim: ClaimView | null;
}

function claimView(c: TodoClaim | undefined, me: string, now: number): ClaimView | null {
    if (!c) return null;
    const live = !!c.done_at || Date.parse(c.claimed_until) > now;
    if (!live) return null;
    return { alias: c.alias, mine: c.claimed_by === me, until: c.claimed_until, done: !!c.done_at };
}

/** The to-do cards: each list's count and who is on it. */
export async function getTodoLists(): Promise<
    ActionResult<{ computedAt: string; lists: TodoCard[]; claimsReady: boolean }>
> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    try {
        const [todo, claims] = await Promise.all([getCachedTodo(), readTodoClaims(getAdminClient())]);
        const all = claims.ready ? claims.claims : [];
        const now = Date.now();
        const lists = todo.lists.map(({ items, ...def }) => {
            void items;
            const mine = all.filter((c) => c.list_key === def.key);
            return {
                ...def,
                claim: claimView(
                    mine.find((c) => c.item_key === "*"),
                    me.user.id,
                    now,
                ),
                rowsClaimed: mine.filter((c) => c.item_key !== "*" && claimView(c, me.user.id, now) && !c.done_at)
                    .length,
            };
        });
        return { success: true, computedAt: todo.computedAt, lists, claimsReady: claims.ready };
    } catch (err) {
        return safeError("RegistryTodo", err, "Could not read the to-do lists. Please try again.");
    }
}

export interface TodoRow extends TodoItem {
    claim: ClaimView | null;
}

/** One to-do list, a page at a time, with who is on each row. Rows marked done since the lists were computed are hidden. */
export async function getTodoList(
    key: string,
    page: number = 1,
): Promise<
    ActionResult<{
        list: TodoListDef;
        count: number;
        kept: number;
        page: number;
        pageCount: number;
        rows: TodoRow[];
        claim: ClaimView | null;
        computedAt: string;
        claimsReady: boolean;
    }>
> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const parsed = ListKey.safeParse(key);
    if (!parsed.success) return fail("There is no such list.");
    try {
        const [todo, claims] = await Promise.all([getCachedTodo(), readTodoClaims(getAdminClient(), parsed.data)]);
        const list = todo.lists.find((l) => l.key === parsed.data)!;
        const byItem = new Map((claims.ready ? claims.claims : []).map((c) => [c.item_key, c]));
        const now = Date.now();
        const open = list.items.filter((i) => {
            const c = byItem.get(i.key);
            return !(c?.done_at && c.done_at > todo.computedAt);
        });
        const pageCount = Math.max(1, Math.ceil(open.length / TODO_PAGE));
        const p = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
        const { items, ...def } = list;
        void items;
        return {
            success: true,
            list: { key: def.key, title: def.title, what: def.what, tone: def.tone },
            count: def.count,
            kept: open.length,
            page: p,
            pageCount,
            rows: open.slice((p - 1) * TODO_PAGE, p * TODO_PAGE).map((i) => ({
                ...i,
                claim: claimView(byItem.get(i.key), me.user.id, now),
            })),
            claim: claimView(byItem.get("*"), me.user.id, now),
            computedAt: todo.computedAt,
            claimsReady: claims.ready,
        };
    } catch (err) {
        return safeError("RegistryTodo", err, "Could not read that list. Please try again.");
    }
}

/** "I'm on it": claim a list (item "*") or one row of it for a day. */
export async function claimTodo(listKey: string, itemKey: string = "*"): Promise<ActionResult<{ until: string }>> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const list = ListKey.safeParse(listKey);
    const item = ItemKey.safeParse(itemKey);
    if (!list.success || !item.success) return fail("There is no such list.");
    const db = desk();
    const { data: existing, error: readError } = await db
        .from("registry_todo_claims")
        .select("claimed_by, claimed_until, done_at")
        .eq("list_key", list.data)
        .eq("item_key", item.data)
        .maybeSingle();
    if (readError) return isMissingSchema(readError) ? fail(PENDING_244) : safeError("RegistryTodo", readError);
    const held = existing as { claimed_by: string; claimed_until: string; done_at: string | null } | null;
    if (held && held.claimed_by !== me.user.id && !held.done_at && Date.parse(held.claimed_until) > Date.now()) {
        const aliases = await aliasesFor(getAdminClient(), [held.claimed_by]);
        return fail(`@${aliases.get(held.claimed_by) ?? "another moderator"} is on it already. Pick another one.`);
    }
    const until = new Date(Date.now() + DAY_MS).toISOString();
    const { error } = await db.from("registry_todo_claims").upsert(
        {
            list_key: list.data,
            item_key: item.data,
            claimed_by: me.user.id,
            claimed_until: until,
            done_at: null,
            created_at: new Date().toISOString(),
        },
        { onConflict: "list_key,item_key" },
    );
    if (error) return isMissingSchema(error) ? fail(PENDING_244) : safeError("RegistryTodo", error);
    revalidatePath("/catalog/desk/todo", "layout");
    return { success: true, until };
}

/** Let a claim go. Your own, or anyone's if you are the owner. */
export async function releaseTodo(listKey: string, itemKey: string = "*"): Promise<ActionResult> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const list = ListKey.safeParse(listKey);
    const item = ItemKey.safeParse(itemKey);
    if (!list.success || !item.success) return fail("There is no such list.");
    let q = desk().from("registry_todo_claims").delete().eq("list_key", list.data).eq("item_key", item.data);
    if (me.role !== "owner") q = q.eq("claimed_by", me.user.id);
    const { error } = await q;
    if (error) return isMissingSchema(error) ? fail(PENDING_244) : safeError("RegistryTodo", error);
    revalidatePath("/catalog/desk/todo", "layout");
    return { success: true };
}

/** Mark a row (or a whole list) done. It drops off until the lists are next computed; if the problem is still there, it comes back. */
export async function markTodoDone(listKey: string, itemKey: string): Promise<ActionResult> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const list = ListKey.safeParse(listKey);
    const item = ItemKey.safeParse(itemKey);
    if (!list.success || !item.success) return fail("There is no such list.");
    const db = desk();
    const { data: existing, error: readError } = await db
        .from("registry_todo_claims")
        .select("claimed_by, claimed_until, done_at")
        .eq("list_key", list.data)
        .eq("item_key", item.data)
        .maybeSingle();
    if (readError) return isMissingSchema(readError) ? fail(PENDING_244) : safeError("RegistryTodo", readError);
    const held = existing as { claimed_by: string; claimed_until: string; done_at: string | null } | null;
    if (held && held.claimed_by !== me.user.id && !held.done_at && Date.parse(held.claimed_until) > Date.now())
        return fail("Someone else is on this one. Let them finish, or ask them to let it go.");
    const now = new Date().toISOString();
    const { error } = await db
        .from("registry_todo_claims")
        .upsert(
            { list_key: list.data, item_key: item.data, claimed_by: me.user.id, claimed_until: now, done_at: now },
            { onConflict: "list_key,item_key" },
        );
    if (error) return isMissingSchema(error) ? fail(PENDING_244) : safeError("RegistryTodo", error);
    revalidatePath("/catalog/desk/todo", "layout");
    return { success: true };
}

/** "Check again": recompute the lists now (after the owner's repair runs, which bypass the app). A few times an hour at most. */
export async function refreshTodoLists(): Promise<ActionResult> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    if (!(await checkRateLimit("registry_todo_refresh", 6, 60, `registry:${me.user.id}`)))
        return fail("The lists were checked a moment ago. Try again in a few minutes.");
    revalidateTag(CACHE_TAGS.registryTodo, "max");
    revalidatePath("/catalog/desk/todo", "layout");
    return { success: true };
}

// ── Style rules ─────────────────────────────────────────────────

export interface RuleView {
    id: string;
    title: string;
    body: string;
    checkKey: string | null;
    fixLabel: string | null;
    fixExample: { before: string; after: string } | null;
    status: RuleStatus;
    proposedBy: string;
    mine: boolean;
    agreements: number;
    agreedBy: string[];
    disagreedBy: { alias: string; note: string | null }[];
    myVote: RuleVote | null;
    createdAt: string;
    inEffectAt: string | null;
    vetoNote: string | null;
    canVote: boolean;
    canWithdraw: boolean;
    canVeto: boolean;
    canRetire: boolean;
}

interface RuleRow {
    id: string;
    title: string;
    body: string;
    check_key: string | null;
    status: RuleStatus;
    proposed_by: string | null;
    created_at: string;
    in_effect_at: string | null;
    veto_note: string | null;
}

interface VoteRecord extends VoteRow {
    rule_id: string;
    note: string | null;
}

const STATUS_ORDER: Record<RuleStatus, number> = { proposed: 0, in_effect: 1, vetoed: 2, retired: 3, withdrawn: 4 };

/** Every rule, proposed first, with its votes and what this moderator may do with it. */
export async function listRules(): Promise<ActionResult<{ rules: RuleView[]; isOwner: boolean }>> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const db = desk();
    const { data, error } = await db
        .from("registry_style_rules")
        .select("id, title, body, check_key, status, proposed_by, created_at, in_effect_at, veto_note")
        .order("created_at", { ascending: false })
        .limit(200);
    if (error) return isMissingSchema(error) ? fail(PENDING_244) : safeError("RegistryRules", error);
    const rules = (data ?? []) as RuleRow[];
    const { data: voteData, error: voteError } = rules.length
        ? await db
              .from("registry_rule_votes")
              .select("rule_id, voter_id, vote, note")
              .in(
                  "rule_id",
                  rules.map((r) => r.id),
              )
        : { data: [], error: null };
    if (voteError) return safeError("RegistryRules", voteError);
    const votes = (voteData ?? []) as VoteRecord[];
    const aliases = await aliasesFor(getAdminClient(), [
        ...rules.map((r) => r.proposed_by),
        ...votes.map((v) => v.voter_id),
    ]);
    const name = (id: string | null) => (id ? (aliases.get(id) ?? "a moderator") : "a former moderator");
    const isOwner = me.role === "owner";
    const views = rules.map((r): RuleView => {
        const mine = votes.filter((v) => v.rule_id === r.id);
        const fix = r.check_key ? FIX_RULES[r.check_key] : undefined;
        const myVote = mine.find((v) => v.voter_id === me.user.id)?.vote ?? null;
        return {
            id: r.id,
            title: r.title,
            body: r.body,
            checkKey: r.check_key,
            fixLabel: fix?.label ?? null,
            fixExample: fix?.example ?? null,
            status: r.status,
            proposedBy: name(r.proposed_by),
            mine: r.proposed_by === me.user.id,
            agreements: agreementCount(r, mine),
            agreedBy: mine
                .filter((v) => v.vote === "agree" && v.voter_id !== r.proposed_by)
                .map((v) => name(v.voter_id)),
            disagreedBy: mine
                .filter((v) => v.vote === "disagree")
                .map((v) => ({ alias: name(v.voter_id), note: v.note })),
            myVote,
            createdAt: r.created_at,
            inEffectAt: r.in_effect_at,
            vetoNote: r.veto_note,
            canVote: !voteProblem(r, me.user.id),
            canWithdraw: canWithdraw(r, me.user.id),
            canVeto: isOwner && canVeto(r.status),
            canRetire: isOwner && canRetire(r.status),
        };
    });
    views.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    return { success: true, rules: views, isOwner };
}

const ProposeRule = z.object({
    title: z.string().trim().min(3, "Give the rule a short name.").max(140, "Keep the name under 140 characters."),
    body: z
        .string()
        .trim()
        .min(10, "Say what the rule asks for, in a sentence or two.")
        .max(2000, "Keep the rule under 2,000 characters."),
    checkKey: z.string().trim().max(60).nullable().optional(),
});

/** Propose a style rule. Up to 10 a day per moderator; the owner is exempt. */
export async function proposeRule(input: {
    title: string;
    body: string;
    checkKey?: string | null;
}): Promise<ActionResult<{ id: string }>> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const parsed = ProposeRule.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the rule.");
    const checkKey = parsed.data.checkKey || null;
    if (!isKnownFix(checkKey)) return fail("That suggested fix doesn't exist. Pick one from the list, or none.");
    // The Registry's own limit (10 a day; owner exempt; the owner is told on a hit).
    const limit = await checkRegistryLimit(actorOf(me), "rule");
    if (!limit.ok) return fail(limit.error);
    const { data, error } = await desk()
        .from("registry_style_rules")
        .insert({
            title: parsed.data.title,
            body: parsed.data.body,
            check_key: checkKey,
            params: {},
            status: "proposed",
            proposed_by: me.user.id,
        })
        .select("id")
        .single();
    if (error) return isMissingSchema(error) ? fail(PENDING_244) : safeError("RegistryRules", error);
    revalidatePath("/catalog/desk/rules");
    return { success: true, id: (data as { id: string }).id };
}

async function readRule(ruleId: string): Promise<RuleRow | ActionFailure> {
    const { data, error } = await desk()
        .from("registry_style_rules")
        .select("id, title, body, check_key, status, proposed_by, created_at, in_effect_at, veto_note")
        .eq("id", ruleId)
        .maybeSingle();
    if (error) return isMissingSchema(error) ? fail(PENDING_244) : safeError("RegistryRules", error);
    if (!data) return fail("That rule is gone.");
    return data as RuleRow;
}

/** Agree, disagree, or take your vote back ("none"). At 3 agreements the rule takes effect. */
export async function voteRule(
    ruleId: string,
    vote: RuleVote | "none",
    note?: string,
): Promise<ActionResult<{ status: RuleStatus; agreements: number }>> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const id = Id.safeParse(ruleId);
    const v = z.enum(["agree", "disagree", "none"]).safeParse(vote);
    const n = z.string().trim().max(500, "Keep the note under 500 characters.").optional().safeParse(note);
    if (!id.success || !v.success) return fail("That rule is gone.");
    if (!n.success) return fail(n.error.issues[0]?.message ?? "Please shorten the note.");
    const rule = await readRule(id.data);
    if ("success" in rule) return rule;
    const problem = voteProblem(rule, me.user.id);
    if (problem) return fail(problem);

    const db = desk();
    const write =
        v.data === "none"
            ? db.from("registry_rule_votes").delete().eq("rule_id", rule.id).eq("voter_id", me.user.id)
            : db.from("registry_rule_votes").upsert(
                  {
                      rule_id: rule.id,
                      voter_id: me.user.id,
                      vote: v.data,
                      note: n.data || null,
                      created_at: new Date().toISOString(),
                  },
                  { onConflict: "rule_id,voter_id" },
              );
    const { error } = await write;
    if (error) return safeError("RegistryRules", error);

    const { data: voteData, error: readError } = await db
        .from("registry_rule_votes")
        .select("voter_id, vote")
        .eq("rule_id", rule.id);
    if (readError) return safeError("RegistryRules", readError);
    const votes = (voteData ?? []) as VoteRow[];
    const status = ruleStatusAfterVote(rule, votes);
    if (status !== rule.status) {
        // Guarded: only a rule still proposed moves (a veto in between wins).
        const { error: moveError } = await db
            .from("registry_style_rules")
            .update({ status, in_effect_at: new Date().toISOString() })
            .eq("id", rule.id)
            .eq("status", "proposed");
        if (moveError) return safeError("RegistryRules", moveError);
        // A rule in effect changes the suggested fixes on every Desk page.
        revalidatePath("/catalog/desk", "layout");
    }
    revalidatePath("/catalog/desk/rules");
    return { success: true, status, agreements: agreementCount(rule, votes) };
}

/** The proposer takes their rule back, while it is still proposed. */
export async function withdrawRule(ruleId: string): Promise<ActionResult> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const id = Id.safeParse(ruleId);
    if (!id.success) return fail("That rule is gone.");
    const rule = await readRule(id.data);
    if ("success" in rule) return rule;
    if (!canWithdraw(rule, me.user.id))
        return fail("Only the moderator who proposed it can withdraw it, before it takes effect.");
    const { error } = await desk()
        .from("registry_style_rules")
        .update({ status: "withdrawn" })
        .eq("id", rule.id)
        .eq("status", "proposed");
    if (error) return safeError("RegistryRules", error);
    revalidatePath("/catalog/desk/rules");
    return { success: true };
}

/** Owner only: veto a rule, proposed or in effect, with a note the moderators see. */
export async function vetoRule(ruleId: string, note: string): Promise<ActionResult> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    if (me.role !== "owner") return fail("Only the site owner can veto a rule.");
    const id = Id.safeParse(ruleId);
    const n = z.string().trim().min(3, "Say why, in a few words.").max(1000).safeParse(note);
    if (!id.success) return fail("That rule is gone.");
    if (!n.success) return fail(n.error.issues[0]?.message ?? "Say why, in a few words.");
    const rule = await readRule(id.data);
    if ("success" in rule) return rule;
    if (!canVeto(rule.status)) return fail("This rule is no longer proposed or in effect.");
    const { error } = await desk()
        .from("registry_style_rules")
        .update({ status: "vetoed", vetoed_at: new Date().toISOString(), veto_note: n.data })
        .eq("id", rule.id)
        .in("status", ["proposed", "in_effect"]);
    if (error) return safeError("RegistryRules", error);
    revalidatePath("/catalog/desk", "layout");
    return { success: true };
}

/** Owner only: retire a rule that is in effect (it has done its job, or the style moved on). */
export async function retireRule(ruleId: string, note?: string): Promise<ActionResult> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    if (me.role !== "owner") return fail("Only the site owner can retire a rule.");
    const id = Id.safeParse(ruleId);
    const n = z.string().trim().max(1000).optional().safeParse(note);
    if (!id.success) return fail("That rule is gone.");
    if (!n.success) return fail("Keep the note under 1,000 characters.");
    const rule = await readRule(id.data);
    if ("success" in rule) return rule;
    if (!canRetire(rule.status)) return fail("Only a rule in effect can be retired.");
    const { error } = await desk()
        .from("registry_style_rules")
        .update({ status: "retired", retired_at: new Date().toISOString(), veto_note: n.data || null })
        .eq("id", rule.id)
        .eq("status", "in_effect");
    if (error) return safeError("RegistryRules", error);
    revalidatePath("/catalog/desk", "layout");
    return { success: true };
}

// ── History ─────────────────────────────────────────────────────

export interface HistoryEntry {
    id: string;
    kind: ActionKind;
    status: ActionStatus;
    summary: string;
    note: string | null;
    itemTitle: string | null;
    catalogItemId: string | null;
    rowCount: number;
    by: string;
    role: ActorRole | null;
    mine: boolean;
    createdAt: string;
    undoUntil: string | null;
    secondLookBy: string | null;
    looksRightBy: string | null;
    undoneBy: string | null;
    canUndo: boolean;
    canMarkLooksRight: boolean;
}

interface ActionRecord {
    id: string;
    kind: ActionKind;
    status: ActionStatus;
    actor_id: string | null;
    actor_role: ActorRole | null;
    catalog_item_id: string | null;
    item_title: string | null;
    summary: string;
    note: string | null;
    row_count: number | null;
    second_look_by: string | null;
    looks_right_by: string | null;
    undone_by: string | null;
    undo_until: string | null;
    created_at: string;
}

const HISTORY_PAGE = 30;
const HistoryFilter = z.object({
    who: z.enum(["all", "mine", "others"]).catch("all"),
    kind: z.enum(["all", "edit", "add", "refile", "approve", "revert", "merge", "remove", "undo"]).catch("all"),
    page: z.coerce.number().int().min(1).max(1000).catch(1),
});
export type HistoryFilterInput = { who?: string; kind?: string; page?: number | string };

/** The Desk's record, newest first: who did what, in which role, and what can still be undone. */
export async function getHistory(filter: HistoryFilterInput = {}): Promise<
    ActionResult<{
        ready: boolean;
        message: string | null;
        entries: HistoryEntry[];
        page: number;
        hasMore: boolean;
        filter: { who: string; kind: string };
    }>
> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const f = HistoryFilter.parse({ who: filter.who, kind: filter.kind, page: filter.page });
    let q = desk()
        .from("registry_actions")
        .select(
            "id, kind, status, actor_id, actor_role, catalog_item_id, item_title, summary, note, row_count, second_look_by, looks_right_by, undone_by, undo_until, created_at",
        )
        .order("created_at", { ascending: false })
        .range((f.page - 1) * HISTORY_PAGE, f.page * HISTORY_PAGE);
    if (f.who === "mine") q = q.eq("actor_id", me.user.id);
    if (f.who === "others") q = q.neq("actor_id", me.user.id);
    if (f.kind !== "all") q = q.eq("kind", f.kind);
    const { data, error } = await q;
    const base = { page: f.page, filter: { who: f.who, kind: f.kind } };
    if (error) {
        if (isMissingSchema(error))
            return { success: true, ready: false, message: PENDING_242, entries: [], hasMore: false, ...base };
        return safeError("RegistryHistory", error, "Could not read the history. Please try again.");
    }
    const rows = (data ?? []) as ActionRecord[];
    const hasMore = rows.length > HISTORY_PAGE;
    const shown = rows.slice(0, HISTORY_PAGE);
    const aliases = await aliasesFor(
        getAdminClient(),
        shown.flatMap((r) => [r.actor_id, r.second_look_by, r.looks_right_by, r.undone_by]),
    );
    const name = (id: string | null) => (id ? (aliases.get(id) ?? "a moderator") : null);
    const now = Date.now();
    const entries = shown.map(
        (r): HistoryEntry => ({
            id: r.id,
            kind: r.kind,
            status: r.status,
            summary: r.summary,
            note: r.note,
            itemTitle: r.item_title,
            catalogItemId: r.catalog_item_id,
            rowCount: r.row_count ?? 1,
            by: name(r.actor_id) ?? "the site",
            role: r.actor_role,
            mine: r.actor_id === me.user.id,
            createdAt: r.created_at,
            undoUntil: r.undo_until,
            secondLookBy: name(r.second_look_by),
            looksRightBy: name(r.looks_right_by),
            undoneBy: name(r.undone_by),
            canUndo: r.status === "applied" && r.kind !== "undo" && !!r.undo_until && Date.parse(r.undo_until) > now,
            canMarkLooksRight: r.status === "applied" && !r.looks_right_by && r.actor_id !== me.user.id,
        }),
    );
    return { success: true, ready: true, message: null, entries, hasMore, ...base };
}

const UndoReason = z
    .string()
    .trim()
    .min(3, "Say why you're undoing it, in a few words.")
    .max(500, "Keep the reason under 500 characters.");

/**
 * Undo an action within 30 days, through the one Registry writer. Fields
 * changed since are left alone; `drifted` says which, in words.
 */
export async function undoAction(
    actionId: string,
    reason: string,
): Promise<ActionResult<{ restored: number; drifted: string[] }>> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const id = Id.safeParse(actionId);
    const r = UndoReason.safeParse(reason);
    if (!id.success) return fail("That entry is gone.");
    if (!r.success) return fail(r.error.issues[0]?.message ?? "Say why you're undoing it.");
    try {
        const out = await undoRegistryAction(actorOf(me), id.data, r.data);
        if (!out.success) return fail(out.error);
        revalidatePath("/catalog/desk", "layout");
        return { success: true, restored: out.restored, drifted: out.drifted };
    } catch (err) {
        return safeError(
            "RegistryUndo",
            err,
            "Could not undo that. It may be past 30 days or already undone; reload the history and check.",
        );
    }
}

/** "Looks right": another moderator has checked this action. Never your own. */
export async function markLooksRight(actionId: string): Promise<ActionResult> {
    const me = await requireRegistryModerator().catch(refused);
    if (isRefusal(me)) return me;
    const id = Id.safeParse(actionId);
    if (!id.success) return fail("That entry is gone.");
    const db = desk();
    const { data, error } = await db
        .from("registry_actions")
        .select("id, actor_id, status, looks_right_by")
        .eq("id", id.data)
        .maybeSingle();
    if (error) return isMissingSchema(error) ? fail(PENDING_242) : safeError("RegistryHistory", error);
    const row = data as { actor_id: string | null; status: string; looks_right_by: string | null } | null;
    if (!row) return fail("That entry is gone.");
    if (row.actor_id === me.user.id) return fail("Someone else checks your work. Ask another moderator to look.");
    if (row.status !== "applied") return fail("Only a change that is in can be checked.");
    if (row.looks_right_by) return fail("Someone has already checked this one.");
    const { error: writeError } = await db
        .from("registry_actions")
        .update({ looks_right_by: me.user.id, looks_right_at: new Date().toISOString() })
        .eq("id", id.data)
        .is("looks_right_by", null);
    if (writeError) return safeError("RegistryHistory", writeError);
    revalidatePath("/catalog/desk/history");
    return { success: true };
}
