import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { registryRoleOf } from "@/lib/auth";
import { getTodoLists } from "@/app/actions/registry-desk-lists";
import DeskListsShell from "@/components/desk/DeskListsShell";
import TodoBoard from "@/components/desk/TodoBoard";

export const metadata: Metadata = {
    title: "To-do · Registry Desk",
    robots: { index: false, follow: false },
};

/** The Registry Desk's to-do lists. Moderators and the owner only; anyone else gets a 404. */
export default async function DeskTodoPage() {
    // Own role check: the Desk's shared layout (Package B) checks too, once merged.
    if (!(await registryRoleOf())) notFound();
    const result = await getTodoLists();
    return (
        <DeskListsShell active="todo">
            {result.success ? (
                <TodoBoard lists={result.lists} computedAt={result.computedAt} claimsReady={result.claimsReady} />
            ) : (
                <div role="alert" className="ledger-card text-secondary-foreground">
                    {result.error}
                </div>
            )}
        </DeskListsShell>
    );
}
