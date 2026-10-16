"use client";

import { useEffect, useState } from "react";
import { getCronHealth } from "@/app/actions/admin";
import type { CronHealth } from "@/lib/ops/heartbeat";

const STATE_WORDS: Record<CronHealth["state"], { label: string; className: string }> = {
    ok: { label: "On time", className: "border-forest/40 text-forest" },
    late: { label: "Late", className: "border-warning/50 text-warning" },
    failing: { label: "Failing", className: "border-destructive/50 text-destructive" },
    unknown: { label: "No runs yet", className: "border-input text-muted-foreground" },
};

const ago = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : "never";

/** Scheduled jobs and whether each is running on time (MHH-029). */
export default function AdminCronCard() {
    const [jobs, setJobs] = useState<CronHealth[] | null>(null);
    const [installed, setInstalled] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        getCronHealth().then((r) => {
            if (!live) return;
            if (!r.success) return setError(r.error);
            setJobs(r.jobs);
            setInstalled(r.installed);
        });
        return () => {
            live = false;
        };
    }, []);

    return (
        <section aria-labelledby="admin-cron-heading">
            <h3 id="admin-cron-heading" className="mt-0 mb-1 text-base font-bold">
                ⏱️ Scheduled jobs
            </h3>
            <p className="mt-0 mb-3 text-xs text-muted-foreground">
                Each job records every run. Late means it hasn&apos;t succeeded for longer than its schedule allows;
                check Vercel › Cron Jobs.
            </p>
            {!installed && (
                <p className="text-xs text-muted-foreground">Heartbeats start once migration 237 is pasted.</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {jobs && (
                <div className="overflow-x-auto rounded-lg border border-input bg-card">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="text-left text-xs text-muted-foreground uppercase">
                                <th className="px-3 py-2">Job</th>
                                <th className="px-3 py-2">Runs</th>
                                <th className="px-3 py-2">Last success</th>
                                <th className="px-3 py-2">State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((j) => (
                                <tr key={j.job} className="border-t border-input align-top">
                                    <td className="px-3 py-2 font-mono text-xs">{j.job}</td>
                                    <td className="px-3 py-2">{j.schedule}</td>
                                    <td className="px-3 py-2">{ago(j.lastOkAt)}</td>
                                    <td className="px-3 py-2">
                                        <span
                                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATE_WORDS[j.state].className}`}
                                        >
                                            {STATE_WORDS[j.state].label}
                                        </span>
                                        {j.state === "failing" && j.lastError && (
                                            <div
                                                className="mt-1 max-w-[28ch] truncate text-xs text-muted-foreground"
                                                title={j.lastError}
                                            >
                                                {j.lastError}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
