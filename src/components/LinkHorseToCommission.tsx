"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LinkHorseToCommission({
    commissionId,
}: {
    commissionId: string;
}) {
    const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
    const [selectedHorseId, setSelectedHorseId] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        const supabase = createClient();
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("user_horses")
                .select("id, custom_name")
                .eq("owner_id", user.id)
                .order("custom_name")
                .limit(200);
            if (data) {
                setHorses((data as { id: string; custom_name: string }[]).map(h => ({
                    id: h.id,
                    name: h.custom_name,
                })));
            }
        })();
    }, []);

    const handleLink = async () => {
        if (!selectedHorseId) return;
        setSaving(true);
        const { linkHorseToCommission } = await import("@/app/actions/art-studio");
        const result = await linkHorseToCommission(commissionId, selectedHorseId);
        if (result.success) {
            setDone(true);
        }
        setSaving(false);
    };

    if (done) {
        return (
            <div className="py-4 px-6 rounded-lg bg-[rgba(44,85,69,0.08)] border border-[rgba(44,85,69,0.2)] text-sm leading-relaxed mt-4" style={{ marginBottom: "var(--space-lg)" }}>
                ✅ Horse linked! WIP photos will appear on its Hoofprint™ upon delivery.
            </div>
        );
    }

    return (
        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-sm)" }}>🔗 Link a Horse from Your Stable</h3>
            <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)", marginBottom: "var(--space-md)" }}>
                Link a horse so WIP photos are added to its Hoofprint™ when this commission is delivered.
            </p>
            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                <select
                    className="form-input"
                    value={selectedHorseId}
                    onChange={e => setSelectedHorseId(e.target.value)}
                    style={{ flex: 1 }}
                >
                    <option value="">Select a horse…</option>
                    {horses.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                </select>
                <button
                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
                    onClick={handleLink}
                    disabled={!selectedHorseId || saving}
                >
                    {saving ? "…" : "Link"}
                </button>
            </div>
        </div>
    );
}
