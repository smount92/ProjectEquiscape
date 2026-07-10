"use client";

/**
 * Console STAFF tab — roster with role badges + COI flags.
 * Add-by-alias: exact lookup (findUserByAlias) → confirm card with
 * role + COI → addShowStaff. Managing staff is HOST-only; the
 * actions re-check server-side.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { addShowStaff, findUserByAlias, removeShowStaff } from "@/app/actions/shows-v2";
import type { ConsoleStaffMember } from "@/lib/shows/console";
import type { StaffRole } from "@/lib/shows/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const ROLE_LABELS: Record<StaffRole, string> = {
    host: "Host",
    co_host: "Co-host",
    steward: "Steward",
    judge: "Judge",
};

type GrantableRole = Exclude<StaffRole, "host">;

interface ShowStaffPanelProps {
    showId: string;
    staff: ConsoleStaffMember[];
    viewerRole: StaffRole;
}

export default function ShowStaffPanel({ showId, staff, viewerRole }: ShowStaffPanelProps) {
    const router = useRouter();
    const isHost = viewerRole === "host";

    const [alias, setAlias] = useState("");
    const [candidate, setCandidate] = useState<{ id: string; alias: string } | null>(null);
    const [notFoundAlias, setNotFoundAlias] = useState<string | null>(null);
    const [role, setRole] = useState<GrantableRole>("steward");
    const [coiFlag, setCoiFlag] = useState(false);
    const [coiNote, setCoiNote] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        setCandidate(null);
        setNotFoundAlias(null);
        const result = await findUserByAlias({ alias });
        if (!result.success) {
            setError(result.error);
        } else if (!result.user) {
            setNotFoundAlias(alias);
        } else {
            setCandidate(result.user);
        }
        setPending(false);
    };

    const handleAdd = async () => {
        if (!candidate) return;
        setPending(true);
        setError(null);
        const result = await addShowStaff({
            showId,
            userId: candidate.id,
            role,
            coiFlag,
            coiNote: coiFlag && coiNote.trim() ? coiNote.trim() : undefined,
        });
        if (result.success) {
            setAlias("");
            setCandidate(null);
            setCoiFlag(false);
            setCoiNote("");
            router.refresh();
        } else {
            setError(result.error);
        }
        setPending(false);
    };

    const handleRemove = async (userId: string) => {
        setPending(true);
        setError(null);
        const result = await removeShowStaff({ showId, userId });
        if (result.success) {
            router.refresh();
        } else {
            setError(result.error);
        }
        setPending(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <section className="ledger-card" aria-labelledby="staff-roster-heading">
                <span className="ledger-tab" id="staff-roster-heading">
                    Staff Roster
                </span>
                <ul className="flex list-none flex-col p-0">
                    {staff.map((member) => (
                        <li
                            key={member.userId}
                            className="flex flex-wrap items-center gap-3 py-2"
                        >
                            <span className="text-sm font-semibold text-foreground">
                                @{member.alias}
                            </span>
                            <Badge variant={member.role === "host" ? "default" : "secondary"}>
                                {ROLE_LABELS[member.role]}
                            </Badge>
                            {member.coiFlag && (
                                <Badge
                                    variant="destructive"
                                    title={member.coiNote ?? "Conflict of interest declared"}
                                >
                                    COI
                                </Badge>
                            )}
                            {member.coiFlag && member.coiNote && (
                                <span className="text-xs text-muted-foreground">{member.coiNote}</span>
                            )}
                            {isHost && member.role !== "host" && (
                                <span className="ml-auto">
                                    <Button
                                        variant="destructive-outline"
                                        size="sm"
                                        disabled={pending}
                                        onClick={() => handleRemove(member.userId)}
                                    >
                                        Remove
                                    </Button>
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            {isHost ? (
                <section className="ledger-card" aria-labelledby="staff-add-heading">
                    <span className="ledger-tab" id="staff-add-heading">
                        Add Staff
                    </span>
                    <form onSubmit={handleLookup} className="flex flex-wrap items-center gap-2">
                        <Input
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            placeholder="Exact alias, e.g. pintopines"
                            className="h-9 w-64 max-w-full"
                            maxLength={60}
                            aria-label="Alias to look up"
                        />
                        <Button type="submit" variant="outline" size="sm" disabled={pending || !alias.trim()}>
                            Look up
                        </Button>
                    </form>
                    {notFoundAlias && (
                        <p className="mt-3 text-sm text-muted-foreground">
                            No user with the alias “{notFoundAlias}” — aliases must match exactly.
                        </p>
                    )}
                    {candidate && (
                        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                            <p className="text-sm text-foreground">
                                Add <strong>@{candidate.alias}</strong> as
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <Select value={role} onValueChange={(v) => setRole(v as GrantableRole)}>
                                    <SelectTrigger className="w-40" size="sm" aria-label="Staff role">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="co_host">Co-host</SelectItem>
                                        <SelectItem value="steward">Steward</SelectItem>
                                        <SelectItem value="judge">Judge</SelectItem>
                                    </SelectContent>
                                </Select>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={coiFlag}
                                        onChange={(e) => setCoiFlag(e.target.checked)}
                                        className="size-4 accent-forest"
                                    />
                                    Conflict of interest
                                </label>
                                {coiFlag && (
                                    <Input
                                        value={coiNote}
                                        onChange={(e) => setCoiNote(e.target.value)}
                                        placeholder="COI note (e.g. shows their own horses)"
                                        className="h-9 w-72 max-w-full"
                                        maxLength={200}
                                        aria-label="COI note"
                                    />
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" disabled={pending} onClick={handleAdd}>
                                    {pending ? "Adding…" : "Add to staff"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() => setCandidate(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                    {error && (
                        <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                            {error}
                        </p>
                    )}
                    <p className="mt-4 text-xs text-muted-foreground">
                        Co-hosts can edit everything except staff. Stewards record day-of class
                        statuses. Judges will get the judging queue when it ships.
                    </p>
                </section>
            ) : (
                <p className="text-sm text-muted-foreground">Only the show host can manage staff.</p>
            )}
        </div>
    );
}
