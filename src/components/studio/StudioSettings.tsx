"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
    createArtistProfile,
    updateArtistProfile,
    updateStudioServices,
    updateStudioTerms,
    type ArtistProfile,
} from "@/app/actions/art-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    SERVICE_SCALES,
    SERVICE_TYPES,
    priceRangeLabel,
    type StudioService,
} from "@/lib/studio/services";
import { DEFAULT_TERMS, type StudioTerms } from "@/lib/studio/terms";

/**
 * Studio settings: identity, rate card, terms.
 *
 * Split into three saves rather than one giant form, because they change
 * on completely different clocks — identity almost never, the rate card
 * once a season, terms once and then never again.
 */

const SPECIALTIES = [
    "Custom (sculpting)",
    "Finishwork (repaint)",
    "Prep work",
    "Resin prep & finish",
    "China painting",
    "Hairing",
    "Tack making",
    "Etching / dremel work",
    "Body mods",
    "Glazework",
    "Props",
    "Dolls & riders",
    "Other animals",
];

const MEDIUMS = [
    "Airbrush acrylics",
    "Hand-brushed acrylics",
    "Oils",
    "Pastel pigments",
    "Coloured pencil",
    "Chalk",
    "Epoxy",
    "Mixed media",
];

const SCALES = [
    "Traditional (1:9)",
    "Classic (1:12)",
    "Stablemate (1:32)",
    "Paddock Pal (1:24)",
    "Micro mini",
    "Medallion",
    "Other",
];

type Tab = "studio" | "rates" | "terms";

export interface OwnBarn {
    id: string;
    name: string;
}

export default function StudioSettings({
    profile,
    ownBarns = [],
}: {
    profile: ArtistProfile | null;
    ownBarns?: OwnBarn[];
}) {
    const [tab, setTab] = useState<Tab>("studio");
    const isNew = !profile;

    if (isNew) return <StudioForm profile={null} ownBarns={ownBarns} />;

    return (
        <div>
            <div className="studio-tabs mb-6">
                {(
                    [
                        ["studio", "Studio"],
                        ["rates", "Rates"],
                        ["terms", "Terms"],
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        className={`studio-tab ${tab === key ? "active" : ""}`}
                        onClick={() => setTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === "studio" && <StudioForm profile={profile} ownBarns={ownBarns} />}
            {tab === "rates" && <ServicesEditor profile={profile} />}
            {tab === "terms" && <TermsEditor profile={profile} />}
        </div>
    );
}

// ── Identity ──────────────────────────────────────────────────────────

function StudioForm({
    profile,
    ownBarns,
}: {
    profile: ArtistProfile | null;
    ownBarns: OwnBarn[];
}) {
    const router = useRouter();
    const [name, setName] = useState(profile?.studioName ?? "");
    const [slug, setSlug] = useState(profile?.studioSlug ?? "");
    const [bio, setBio] = useState(profile?.bioArtist ?? "");
    const [paypal, setPaypal] = useState(profile?.paypalMeLink ?? "");
    const [barnId, setBarnId] = useState(profile?.barnGroupId ?? "");
    const [specialties, setSpecialties] = useState<string[]>(profile?.specialties ?? []);
    const [mediums, setMediums] = useState<string[]>(profile?.mediums ?? []);
    const [scales, setScales] = useState<string[]>(profile?.scalesOffered ?? []);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const isNew = !profile;
    const autoSlug = slug || slugPreview(name);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);

        const form = new FormData();
        form.set("studioName", name);
        form.set("studioSlug", autoSlug);
        form.set("bioArtist", bio);
        form.set("paypalMeLink", paypal);
        form.set("specialties", JSON.stringify(specialties));
        form.set("mediums", JSON.stringify(mediums));
        form.set("scalesOffered", JSON.stringify(scales));
        form.set("acceptingTypes", JSON.stringify(specialties));
        form.set("barnGroupId", barnId);

        const result = isNew
            ? await createArtistProfile(form)
            : await updateArtistProfile(form);
        setBusy(false);

        if (!result.success) {
            setError(result.error ?? "That didn't save.");
            return;
        }
        if (isNew && "slug" in result && result.slug) {
            router.push("/studio/dashboard");
            return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
    };

    return (
        <form onSubmit={submit} className="grid gap-6">
            <div className="bg-card border-input rounded-lg border p-6 shadow-md">
                <h2 className="mb-4 font-serif text-lg font-bold">Your studio</h2>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold">Studio name</span>
                    <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Willow Creek Studio"
                        required
                    />
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold">Web address</span>
                    <Input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder={slugPreview(name) || "willow-creek-studio"}
                    />
                    <span className="text-muted-foreground mt-1 block text-xs">
                        modelhorsehub.com/studio/<strong>{autoSlug || "your-studio"}</strong> — this
                        is the link you&rsquo;ll paste into groups, so keep it short.
                    </span>
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold">About your work</span>
                    <Textarea
                        rows={5}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="What you do, how you work, and what you're known for. This is the first thing a commissioner reads."
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-sm font-semibold">
                        Payment link <span className="text-muted-foreground">(optional)</span>
                    </span>
                    <Input
                        type="url"
                        value={paypal}
                        onChange={(e) => setPaypal(e.target.value)}
                        placeholder="https://paypal.me/yourname"
                    />
                    <span className="text-muted-foreground mt-1 block text-xs">
                        Shown to commissioners once terms are agreed. Model Horse Hub never
                        handles the money — you two arrange it directly.
                    </span>
                </label>

                {ownBarns.length > 0 && (
                    <label className="mt-4 block">
                        <span className="mb-1 block text-sm font-semibold">
                            The studio&rsquo;s barn <span className="text-muted-foreground">(optional)</span>
                        </span>
                        <select
                            className="border-input bg-card flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                            value={barnId}
                            onChange={(e) => setBarnId(e.target.value)}
                        >
                            <option value="">— none —</option>
                            {ownBarns.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <span className="text-muted-foreground mt-1 block text-xs">
                            A barn you run, shown on your studio page as its community room —
                            clients and followers gather there between commissions.
                        </span>
                    </label>
                )}
            </div>

            <div className="bg-card border-input rounded-lg border p-6 shadow-md">
                <h2 className="mb-4 font-serif text-lg font-bold">What you do</h2>
                <PickList
                    label="Specialties"
                    options={SPECIALTIES}
                    selected={specialties}
                    onChange={setSpecialties}
                />
                <PickList
                    label="Mediums"
                    options={MEDIUMS}
                    selected={mediums}
                    onChange={setMediums}
                />
                <PickList label="Scales" options={SCALES} selected={scales} onChange={setScales} />
            </div>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border px-4 py-3 text-sm">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="wide" disabled={busy || !name.trim()}>
                    {busy ? "Saving…" : isNew ? "Open your studio" : "Save changes"}
                </Button>
                {saved && <span className="text-success text-sm">✓ Saved</span>}
                {!isNew && profile && (
                    <Button asChild type="button" variant="outline" size="wide">
                        <Link href={`/studio/${profile.studioSlug}`}>View your page</Link>
                    </Button>
                )}
            </div>

            {isNew && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                    Your studio opens <strong>closed</strong> to commissions. Add your rates and
                    terms first, then open intake from your dashboard when you&rsquo;re ready —
                    announcing yourself as open before you have terms is how artists end up with a
                    queue they never agreed to.
                </p>
            )}
        </form>
    );
}

function slugPreview(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function PickList({
    label,
    options,
    selected,
    onChange,
}: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    return (
        <div className="mb-4">
            <span className="mb-2 block text-sm font-semibold">{label}</span>
            <div className="flex flex-wrap gap-1.5">
                {options.map((option) => {
                    const on = selected.includes(option);
                    return (
                        <button
                            key={option}
                            type="button"
                            className={`studio-chip ${on ? "active" : ""}`}
                            onClick={() =>
                                onChange(
                                    on
                                        ? selected.filter((s) => s !== option)
                                        : [...selected, option],
                                )
                            }
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Rate card ─────────────────────────────────────────────────────────

/**
 * Per-scale pricing. One flat range across a whole studio isn't a price in
 * a hobby where a Stablemate is $150–350 and a Traditional is $500–1,200
 * and prep is billed as its own line.
 */
function ServicesEditor({ profile }: { profile: ArtistProfile }) {
    const router = useRouter();
    const [services, setServices] = useState<StudioService[]>(profile.services);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const update = (id: string, patch: Partial<StudioService>) =>
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

    const add = () =>
        setServices((prev) => [
            ...prev,
            {
                id: `svc-${Date.now()}`,
                type: SERVICE_TYPES[1],
                scale: "Traditional",
                priceMin: null,
                priceMax: null,
                note: null,
                open: true,
            },
        ]);

    const save = async () => {
        setBusy(true);
        setError(null);
        const result = await updateStudioServices(services);
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "That didn't save.");
            return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
    };

    return (
        <div className="grid gap-6">
            <div className="bg-card border-input rounded-lg border p-6 shadow-md">
                <h2 className="mb-1 font-serif text-lg font-bold">Your rate card</h2>
                <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                    Price by scale — a Stablemate and a Traditional aren&rsquo;t the same job.
                    Ranges are fine and expected; you send the real quote once you&rsquo;ve seen
                    the references. Keep prep as its own line if you bill it separately.
                </p>

                {services.length === 0 ? (
                    <p className="text-muted-foreground mb-4 text-sm">
                        Nothing listed yet. Add your first service below.
                    </p>
                ) : (
                    <div className="mb-4 grid gap-4">
                        {services.map((service) => (
                            <div
                                key={service.id}
                                className="border-input bg-muted/40 rounded-lg border p-4"
                            >
                                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold">
                                            Work type
                                        </span>
                                        <select
                                            className="border-input bg-card h-10 w-full rounded-md border px-3 text-sm"
                                            value={service.type}
                                            onChange={(e) =>
                                                update(service.id, { type: e.target.value })
                                            }
                                        >
                                            {SERVICE_TYPES.map((t) => (
                                                <option key={t} value={t}>
                                                    {t}
                                                </option>
                                            ))}
                                            {!SERVICE_TYPES.includes(
                                                service.type as (typeof SERVICE_TYPES)[number],
                                            ) && (
                                                <option value={service.type}>{service.type}</option>
                                            )}
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold">
                                            Scale
                                        </span>
                                        <select
                                            className="border-input bg-card h-10 w-full rounded-md border px-3 text-sm"
                                            value={service.scale}
                                            onChange={(e) =>
                                                update(service.id, { scale: e.target.value })
                                            }
                                        >
                                            {SERVICE_SCALES.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold">
                                            From
                                        </span>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={5}
                                            value={service.priceMin ?? ""}
                                            onChange={(e) =>
                                                update(service.id, {
                                                    priceMin: e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                })
                                            }
                                            placeholder="500"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold">To</span>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={5}
                                            value={service.priceMax ?? ""}
                                            onChange={(e) =>
                                                update(service.id, {
                                                    priceMax: e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                })
                                            }
                                            placeholder="1200"
                                        />
                                    </label>
                                </div>

                                <label className="mb-3 block">
                                    <span className="mb-1 block text-xs font-semibold">
                                        Note <span className="text-muted-foreground">(optional)</span>
                                    </span>
                                    <Input
                                        type="text"
                                        value={service.note ?? ""}
                                        onChange={(e) =>
                                            update(service.id, { note: e.target.value || null })
                                        }
                                        placeholder="e.g. prep quoted separately; appaloosa +$150"
                                    />
                                </label>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                                        <input
                                            type="checkbox"
                                            checked={service.open}
                                            onChange={(e) =>
                                                update(service.id, { open: e.target.checked })
                                            }
                                            className="h-4 w-4"
                                        />
                                        Taking this work
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground text-xs">
                                            {priceRangeLabel(service.priceMin, service.priceMax)}
                                        </span>
                                        <button
                                            type="button"
                                            className="text-destructive text-xs hover:underline"
                                            onClick={() =>
                                                setServices((prev) =>
                                                    prev.filter((s) => s.id !== service.id),
                                                )
                                            }
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Button type="button" variant="outline" onClick={add}>
                    + Add a service
                </Button>
            </div>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border px-4 py-3 text-sm">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button size="wide" onClick={save} disabled={busy}>
                    {busy ? "Saving…" : "Save rate card"}
                </Button>
                {saved && <span className="text-success text-sm">✓ Saved</span>}
            </div>
        </div>
    );
}

// ── Terms ─────────────────────────────────────────────────────────────

/**
 * Structured terms. These attach to every quote, and the version a
 * commissioner accepts is frozen onto their commission — so editing here
 * never rewrites an agreement already made.
 */
function TermsEditor({ profile }: { profile: ArtistProfile }) {
    const router = useRouter();
    const [terms, setTerms] = useState<StudioTerms>(profile.terms ?? DEFAULT_TERMS);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const set = <K extends keyof StudioTerms>(key: K, value: StudioTerms[K]) =>
        setTerms((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        setBusy(true);
        setError(null);
        const result = await updateStudioTerms(terms);
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "That didn't save.");
            return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
    };

    return (
        <div className="grid gap-6">
            <div className="bg-card border-input rounded-lg border p-6 shadow-md">
                <h2 className="mb-1 font-serif text-lg font-bold">Your commission terms</h2>
                <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                    Written once, shown to every commissioner before they request, and attached to
                    every quote you send. When someone accepts, this exact version is frozen onto
                    their commission — change these whenever you like without touching agreements
                    you&rsquo;ve already made.
                </p>

                <Field label="Deposit" hint="Most artists take 30–50% before starting.">
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            className="max-w-[100px]"
                            value={terms.depositPercent}
                            onChange={(e) => set("depositPercent", Number(e.target.value) || 0)}
                        />
                        <span className="text-sm">% up front</span>
                    </div>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={terms.depositRefundableBeforeStart}
                            onChange={(e) =>
                                set("depositRefundableBeforeStart", e.target.checked)
                            }
                            className="h-4 w-4"
                        />
                        Refundable until work begins
                    </label>
                </Field>

                <Field
                    label="Revisions"
                    hint="Counted automatically. Once the allowance runs out, the commissioner is told extras may be charged."
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            type="number"
                            min={0}
                            max={20}
                            className="max-w-[100px]"
                            value={terms.revisionsIncluded}
                            onChange={(e) => set("revisionsIncluded", Number(e.target.value) || 0)}
                        />
                        <span className="text-sm">included, then</span>
                        <Input
                            type="number"
                            min={0}
                            step={5}
                            className="max-w-[120px]"
                            value={terms.extraRevisionFee ?? ""}
                            onChange={(e) =>
                                set(
                                    "extraRevisionFee",
                                    e.target.value ? Number(e.target.value) : null,
                                )
                            }
                            placeholder="quoted"
                        />
                        <span className="text-sm">each</span>
                    </div>
                </Field>

                <Field
                    label="Turnaround"
                    hint="A range, not a promise. 1–4 months is normal for this kind of work."
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            type="number"
                            min={0}
                            className="max-w-[100px]"
                            value={terms.turnaroundMinDays ?? ""}
                            onChange={(e) =>
                                set(
                                    "turnaroundMinDays",
                                    e.target.value ? Number(e.target.value) : null,
                                )
                            }
                            placeholder="30"
                        />
                        <span className="text-sm">to</span>
                        <Input
                            type="number"
                            min={0}
                            className="max-w-[100px]"
                            value={terms.turnaroundMaxDays ?? ""}
                            onChange={(e) =>
                                set(
                                    "turnaroundMaxDays",
                                    e.target.value ? Number(e.target.value) : null,
                                )
                            }
                            placeholder="120"
                        />
                        <span className="text-sm">days</span>
                    </div>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={terms.acceptsRush}
                            onChange={(e) => set("acceptsRush", e.target.checked)}
                            className="h-4 w-4"
                        />
                        I&rsquo;ll consider rush orders
                    </label>
                </Field>

                <Field
                    label="If a commission is cancelled"
                    hint="What's owed for work already done. 50% before the final stage is the common figure. Model Horse Hub doesn't collect it — this is the number you both agreed to."
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            className="max-w-[100px]"
                            value={terms.killFeePercent}
                            onChange={(e) => set("killFeePercent", Number(e.target.value) || 0)}
                        />
                        <span className="text-sm">% of the agreed price</span>
                    </div>
                </Field>

                <Field label="Shipping">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={terms.clientShipsModel}
                            onChange={(e) => set("clientShipsModel", e.target.checked)}
                            className="h-4 w-4"
                        />
                        The commissioner sends me the model
                    </label>
                    <Input
                        type="text"
                        className="mt-2"
                        value={terms.shippingNote ?? ""}
                        onChange={(e) => set("shippingNote", e.target.value || null)}
                        placeholder="e.g. Return shipping insured, paid by the commissioner"
                    />
                </Field>

                <Field
                    label="Anything else"
                    hint="For things the fields above can't carry. Keep it short — the structured terms are what commissioners actually read."
                >
                    <Textarea
                        rows={4}
                        value={terms.extraNote ?? ""}
                        onChange={(e) => set("extraNote", e.target.value || null)}
                        placeholder="e.g. I photograph finished work for my portfolio. I don't paint from photos of other artists' pieces."
                    />
                </Field>
            </div>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border px-4 py-3 text-sm">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button size="wide" onClick={save} disabled={busy}>
                    {busy ? "Saving…" : "Save terms"}
                </Button>
                {saved && <span className="text-success text-sm">✓ Saved</span>}
            </div>
        </div>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border-input/60 mb-5 border-b pb-5 last:mb-0 last:border-b-0 last:pb-0">
            <span className="mb-1 block text-sm font-semibold">{label}</span>
            {hint && (
                <p className="text-muted-foreground mb-2 text-xs leading-relaxed">{hint}</p>
            )}
            {children}
        </div>
    );
}
