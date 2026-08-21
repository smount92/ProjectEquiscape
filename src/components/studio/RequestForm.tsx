"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createCommission, type ArtistProfile } from "@/app/actions/art-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { priceRangeLabel, serviceLabel } from "@/lib/studio/services";
import { termsLines, turnaroundLabel } from "@/lib/studio/terms";

/**
 * The commission request — an INQUIRY, not an order.
 *
 * The research is unanimous that the artist's first job is asking
 * clarifying questions (subject, scale, references, deadline, budget), so
 * this form pre-answers them. What it deliberately does NOT do is set a
 * price: the commissioner names a budget, the artist quotes. v1 wrote the
 * client's budget straight into `price_quoted` and had the artist "accept"
 * it, which inverted the one negotiation the whole flow exists for.
 *
 * The terms are shown here, above the button, because agreeing to terms
 * you were never shown is not agreement.
 */
export default function RequestForm({
    artist,
    asWaitlist,
}: {
    artist: ArtistProfile;
    asWaitlist: boolean;
}) {
    const router = useRouter();
    const openServices = artist.services.filter((s) => s.open);

    const [serviceId, setServiceId] = useState(openServices[0]?.id ?? "");
    const [customType, setCustomType] = useState("");
    const [description, setDescription] = useState("");
    const [budget, setBudget] = useState("");
    const [references, setReferences] = useState("");
    const [horseId, setHorseId] = useState("");
    const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The commissioner's own stable — linking a horse is what later drives
    // provenance, the artist credit, and the vault hand-off.
    useEffect(() => {
        const supabase = createClient();
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("user_horses")
                .select("id, custom_name")
                .eq("owner_id", user.id)
                .order("custom_name")
                .limit(200);
            setHorses(
                ((data as { id: string; custom_name: string }[] | null) ?? []).map((h) => ({
                    id: h.id,
                    name: h.custom_name,
                })),
            );
        })();
    }, []);

    const service = openServices.find((s) => s.id === serviceId);
    const commissionType = service ? service.type : customType.trim();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!commissionType) {
            setError("Choose a service, or describe the work you're after.");
            return;
        }
        if (description.trim().length < 20) {
            setError(
                "Give the artist a bit more to go on — what horse, what colour, what you're picturing.",
            );
            return;
        }

        setSaving(true);
        const result = await createCommission({
            artistId: artist.userId,
            commissionType,
            serviceScale: service?.scale,
            description: description.trim(),
            referenceImages: references
                .split(/[\s,]+/)
                .map((u) => u.trim())
                .filter((u) => /^https?:\/\//i.test(u))
                .slice(0, 8),
            budget: budget ? Number(budget) : undefined,
            horseId: horseId || undefined,
        });
        setSaving(false);

        if (!result.success) {
            setError(result.error ?? "Something went wrong sending that request.");
            return;
        }
        router.push(`/studio/commission/${result.commissionId}`);
    };

    return (
        <form onSubmit={handleSubmit} className="grid gap-6">
            {asWaitlist && (
                <div className="border-warning/40 bg-warning/10 rounded-lg border p-4 text-sm leading-relaxed">
                    <strong>{artist.studioName}</strong>&rsquo;s bench is full, so this goes to
                    their waitlist. They&rsquo;ll quote when a slot opens — waitlists here
                    aren&rsquo;t first-come-first-served, so tell them what makes your project
                    yours.
                </div>
            )}

            <div className="bg-card border-input rounded-lg border p-6 shadow-md">
                <h2 className="mb-4 font-serif text-lg font-bold">What are you after?</h2>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold">Service</span>
                    {openServices.length > 0 ? (
                        <select
                            className="border-input bg-card ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                            value={serviceId}
                            onChange={(e) => setServiceId(e.target.value)}
                        >
                            {openServices.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {serviceLabel(s)} — {priceRangeLabel(s.priceMin, s.priceMax)}
                                </option>
                            ))}
                            <option value="">Something else…</option>
                        </select>
                    ) : (
                        <Input
                            type="text"
                            value={customType}
                            onChange={(e) => setCustomType(e.target.value)}
                            placeholder="e.g. Finishwork (repaint), Traditional scale"
                        />
                    )}
                    {openServices.length > 0 && !service && (
                        <Input
                            type="text"
                            className="mt-2"
                            value={customType}
                            onChange={(e) => setCustomType(e.target.value)}
                            placeholder="Describe the work you're after"
                        />
                    )}
                    {service?.note && (
                        <span className="text-muted-foreground mt-1 block text-xs">
                            {service.note}
                        </span>
                    )}
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold">
                        Describe the commission
                    </span>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={6}
                        placeholder="Which model, what colour and markings, whether it needs prep, and any deadline you're working to. The more you say here, the closer the artist's quote will be."
                    />
                    <span className="text-muted-foreground mt-1 block text-xs">
                        Coat complexity drives the price in this hobby — mention pinto markings,
                        appaloosa spots, dapples or roaning if you want them.
                    </span>
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold">
                        Reference images <span className="text-muted-foreground">(optional)</span>
                    </span>
                    <Textarea
                        value={references}
                        onChange={(e) => setReferences(e.target.value)}
                        rows={2}
                        placeholder="Paste image links, one per line"
                    />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold">
                            Your budget{" "}
                            <span className="text-muted-foreground">(optional)</span>
                        </span>
                        <Input
                            type="number"
                            min={0}
                            step={5}
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            placeholder="e.g. 800"
                        />
                        <span className="text-muted-foreground mt-1 block text-xs">
                            A guide, not an offer. The artist sends the actual quote.
                        </span>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold">
                            Your horse <span className="text-muted-foreground">(optional)</span>
                        </span>
                        <select
                            className="border-input bg-card ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                            value={horseId}
                            onChange={(e) => setHorseId(e.target.value)}
                        >
                            <option value="">Not linked to a horse yet</option>
                            {horses.map((h) => (
                                <option key={h.id} value={h.id}>
                                    {h.name}
                                </option>
                            ))}
                        </select>
                        <span className="text-muted-foreground mt-1 block text-xs">
                            Links the finished work to its passport, and lets you file the cost
                            into its vault afterwards.
                        </span>
                    </label>
                </div>
            </div>

            {/* Terms, before the button. Agreeing to terms you were never
                shown is not agreement. */}
            <div className="bg-card border-input rounded-lg border p-6 shadow-md">
                <h2 className="mb-1 font-serif text-lg font-bold">
                    {artist.studioName}&rsquo;s terms
                </h2>
                <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
                    You aren&rsquo;t agreeing to anything yet — these apply once you accept a
                    quote, and the version you accept is saved with your commission even if the
                    artist changes them later.
                </p>
                <div className="grid">
                    {termsLines(artist.terms).map((line) => (
                        <div
                            key={line.label}
                            className="border-input/60 flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-b-0"
                        >
                            <span className="text-muted-foreground text-sm">{line.label}</span>
                            <span className="text-right text-sm font-semibold">{line.value}</span>
                        </div>
                    ))}
                    <div className="border-input/60 flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-b-0">
                        <span className="text-muted-foreground text-sm">Turnaround</span>
                        <span className="text-right text-sm font-semibold">
                            {turnaroundLabel(artist.terms)}
                        </span>
                    </div>
                </div>
                {artist.terms.extraNote && (
                    <p className="text-secondary-foreground mt-4 text-sm leading-relaxed whitespace-pre-wrap">
                        {artist.terms.extraNote}
                    </p>
                )}
            </div>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border px-4 py-3 text-sm">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="wide" disabled={saving}>
                    {saving
                        ? "Sending…"
                        : asWaitlist
                          ? "Join the waitlist"
                          : "Send this request"}
                </Button>
                <Button asChild type="button" variant="outline" size="wide">
                    <Link href={`/studio/${artist.studioSlug}`}>Back to the studio</Link>
                </Button>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
                🤝 Sending a request costs nothing and commits you to nothing. The artist replies
                with a quote — a price, a timeline and these terms — and only then do you decide.
                Payment is arranged directly between the two of you; Model Horse Hub never handles
                the money.
            </p>
        </form>
    );
}
