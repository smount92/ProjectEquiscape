import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { registryRoleOf } from "@/lib/auth";
import { getTodoList } from "@/app/actions/registry-desk-lists";
import { TODO_LISTS } from "@/lib/registry/checks";
import DeskListsShell from "@/components/desk/DeskListsShell";
import TodoListTable from "@/components/desk/TodoListTable";

export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
    const { list } = await params;
    const def = TODO_LISTS.find((d) => d.key === list);
    return { title: `${def?.title ?? "To-do"} · Registry Desk`, robots: { index: false, follow: false } };
}

/** One to-do list, a page at a time; each row opens the Mold view with that release picked. */
export default async function DeskTodoListPage({
    params,
    searchParams,
}: {
    params: Promise<{ list: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    // Own role check: the Desk's shared layout (Package B) checks too, once merged.
    if (!(await registryRoleOf())) notFound();
    const { list } = await params;
    if (!TODO_LISTS.some((d) => d.key === list)) notFound();
    const sp = await searchParams;
    const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1;
    const result = await getTodoList(list, page);
    return (
        <DeskListsShell active="todo">
            {result.success ? (
                <TodoListTable
                    list={result.list}
                    rows={result.rows}
                    count={result.count}
                    kept={result.kept}
                    page={result.page}
                    pageCount={result.pageCount}
                    claimsReady={result.claimsReady}
                />
            ) : (
                <div role="alert" className="ledger-card text-secondary-foreground">
                    {result.error}
                </div>
            )}
        </DeskListsShell>
    );
}
