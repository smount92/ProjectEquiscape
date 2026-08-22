"use client";

/**
 * Settings — the config hub, rewritten as a ledger.
 *
 * The old page was a stack of generic cards written before the leather
 * rollout, and the site grew around it: notification prefs listed a
 * hand-typed dozen types while the show domain added six more, the
 * insurance report was a bare download link with no scope picker, and
 * nothing pointed at /market/reports. This is a display rebuild — every
 * server action is consumed with its existing signature, and the
 * notification jsonb keeps exactly the shape updateNotificationPrefs
 * already writes.
 *
 * House vocabulary: each section is a ledger leaf (.ledger-card) wearing
 * a kraft index tab (.ledger-tab), with a jump rail of the same tabs at
 * the head of the page. Both classes already carry their Lamplight and
 * Simple Mode treatments, so the night house rule (no ruled lines) and
 * the flat-card Simple Mode come for free rather than being reinvented
 * here.
 */

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    getProfile,
    updateProfile,
    updateNotificationPrefs,
    changePassword,
    uploadAvatar,
    deleteAccount,
} from "@/app/actions/settings";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import SupporterLedgerToggle from "@/components/SupporterLedgerToggle";
import InsuranceReportButton from "@/components/InsuranceReportButton";
import ExportButton from "@/components/ExportButton";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { AlertTriangle, Trash2, Camera, Palette } from "lucide-react";
import {
    NOTIFICATION_PREF_GROUPS,
    isNotifPrefOn,
    toggledPrefs,
} from "./notificationGroups";

/** The index rail across the head of the ledger. */
const SECTIONS: { id: string; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Privacy" },
    { id: "showing", label: "Showing" },
    { id: "reports", label: "Reports" },
    { id: "subscription", label: "Subscription" },
    { id: "account", label: "Account" },
];

/** One ledger leaf: paper, kraft tab, anchor target for the rail. */
function Leaf({
    id,
    tab,
    children,
    className = "",
}: {
    id: string;
    tab: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section id={id} className={`ledger-card scroll-mt-24 ${className}`}>
            <span className="ledger-tab">{tab}</span>
            {children}
        </section>
    );
}

/** Serif smallcaps heading with a hairline rule running to the margin. */
function LeafHeading({ children }: { children: ReactNode }) {
    return (
        <div className="mt-6 mb-3 flex items-baseline gap-3 first:mt-0">
            <h3 className="text-forest m-0 font-serif text-[0.95rem] font-bold tracking-[0.1em] whitespace-nowrap uppercase">
                {children}
            </h3>
            <span
                className="from-forest/40 h-px flex-1 bg-gradient-to-r to-transparent"
                aria-hidden="true"
            />
        </div>
    );
}

/** A labelled switch row. Hint text is part of the row, not a tooltip. */
function ToggleRow({
    icon,
    label,
    hint,
    on,
    onToggle,
}: {
    icon: string;
    label: string;
    hint?: string;
    on: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border-input flex items-start justify-between gap-4 border-b py-3 last:border-b-0 max-sm:gap-2">
            <div className="min-w-0">
                <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden="true">{icon}</span> {label}
                </span>
                {hint && (
                    <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                        {hint}
                    </span>
                )}
            </div>
            <button
                type="button"
                className={`mt-0.5 shrink-0 ${on ? "settings-toggle-active" : "settings-toggle"}`}
                onClick={onToggle}
                aria-pressed={on ? "true" : "false"}
                aria-label={`Toggle ${label}`}
                title={`Toggle ${label}`}
            />
        </div>
    );
}

/** The honest footnote under a group whose types always deliver. */
function AlwaysOnNote({ children }: { children: ReactNode }) {
    return (
        <p className="border-forest/40 text-secondary-foreground mt-3 border-l-2 pl-3 text-xs leading-relaxed">
            {children}
        </p>
    );
}

export default function SettingsClient() {
    const router = useRouter();
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Loading
    const [isLoading, setIsLoading] = useState(true);

    // Profile
    const [aliasName, setAliasName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [defaultHorsePublic, setDefaultHorsePublic] = useState(true);
    const [watermarkPhotos, setWatermarkPhotos] = useState(false);
    const [watermarkText, setWatermarkText] = useState("");
    const [showBadges, setShowBadges] = useState(true);
    const [showPhotosOnReference, setShowPhotosOnReference] = useState(true);
    const [currencySymbol, setCurrencySymbol] = useState("$");
    const [exhibitorNumber, setExhibitorNumber] = useState("");
    const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(
        null,
    );
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    /**
     * updateProfile takes every field at once, so Profile, Privacy and
     * Showing share one save. Three leaves therefore share one button —
     * and the result has to appear beside the button that was actually
     * pressed, not scrolled off at the top of the page.
     */
    const [saveOrigin, setSaveOrigin] = useState<string | null>(null);

    // Notifications
    const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

    // Password
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(
        null,
    );
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    // Avatar upload
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);

    // Delete account
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Supporters' Ledger opt-in — null until (unless) the viewer turns out
    // to be an active supporter; the toggle stays hidden for everyone else.
    const [supporterLedger, setSupporterLedger] = useState<{ listed: boolean } | null>(null);

    useEffect(() => {
        async function load() {
            const profile = await getProfile();
            if (!profile) {
                router.push("/login");
                return;
            }
            setAliasName(profile.aliasName);
            setBio(profile.bio);
            setAvatarUrl(profile.avatarUrl);
            setEmail(profile.email);
            setNotifPrefs(profile.notificationPrefs);
            setDefaultHorsePublic(profile.defaultHorsePublic);
            setWatermarkPhotos(profile.watermarkPhotos);
            setWatermarkText(profile.watermarkText);
            setShowBadges(profile.showBadges);
            setShowPhotosOnReference(profile.showPhotosOnReference);
            setCurrencySymbol(profile.currencySymbol);
            setExhibitorNumber(profile.exhibitorNumber || "");
            setIsLoading(false);

            // Supporter state, read client-side from the viewer's own users row
            // (columns are SELECT-granted to authenticated per migration 142).
            // Runs after the page is interactive; any error — including the
            // columns not existing yet — just leaves the toggle hidden.
            try {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (user) {
                    const { data: srow } = await supabase
                        .from("users")
                        .select("is_supporter, show_in_supporters_ledger")
                        .eq("id", user.id)
                        .maybeSingle();
                    if (srow?.is_supporter === true) {
                        setSupporterLedger({ listed: srow.show_in_supporters_ledger === true });
                    }
                }
            } catch {
                // Not a supporter as far as this page can tell — no toggle.
            }
        }
        load();
    }, [router]);

    // ── Profile save (shared by Profile / Privacy / Showing) ──
    const handleSaveProfile = async (origin: string) => {
        setSaveOrigin(origin);
        setIsSavingProfile(true);
        setProfileMsg(null);
        const result = await updateProfile({
            aliasName,
            bio,
            defaultHorsePublic,
            watermarkPhotos,
            watermarkText,
            showBadges,
            showPhotosOnReference,
            currencySymbol,
            exhibitorNumber,
        });
        if (result.success) {
            setProfileMsg({ type: "success", text: "Saved." });
        } else {
            setProfileMsg({ type: "error", text: result.error || "Failed to save." });
        }
        setIsSavingProfile(false);
    };

    // ── Notification toggle ──
    const handleToggleNotif = async (key: string) => {
        const updated = toggledPrefs(notifPrefs, key);
        setNotifPrefs(updated);
        await updateNotificationPrefs(updated);
    };

    // ── Password change ──
    const handleChangePassword = async () => {
        setIsSavingPassword(true);
        setPasswordMsg(null);
        const result = await changePassword({ currentPassword, newPassword, confirmPassword });
        if (result.success) {
            setPasswordMsg({ type: "success", text: "Password changed!" });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } else {
            setPasswordMsg({ type: "error", text: result.error || "Failed to change password." });
        }
        setIsSavingPassword(false);
    };

    // ── Avatar upload ──
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingAvatar(true);
        setAvatarError(null);
        const formData = new FormData();
        formData.set("avatar", file);
        const result = await uploadAvatar(formData);
        if (result.success && result.url) {
            setAvatarUrl(result.url + "?t=" + Date.now()); // bust cache
        } else {
            setAvatarError(result.error || "Avatar upload failed — please try again.");
        }
        setIsUploadingAvatar(false);
        e.target.value = "";
    };

    /** Save button + its result, rendered beside the leaf that owns it. */
    const saveControl = (origin: string, label: string) => (
        <>
            <Button onClick={() => handleSaveProfile(origin)} disabled={isSavingProfile}>
                {isSavingProfile && saveOrigin === origin ? "Saving…" : label}
            </Button>
            {profileMsg && saveOrigin === origin && (
                <p
                    className={`mt-2 text-sm font-medium ${
                        profileMsg.type === "success"
                            ? "text-forest flex items-center gap-1 before:content-['✓']"
                            : "form-error"
                    }`}
                    role="status"
                >
                    {profileMsg.text}
                </p>
            )}
        </>
    );

    if (isLoading) {
        return (
            <ExplorerLayout noHeader frameless>
                <PageMasthead
                    compact
                    icon="⚙️"
                    title="Settings"
                    subtitle="Loading your ledger…"
                    backHref="/dashboard"
                    backLabel="Digital Stable"
                />
                <div className="mx-auto max-w-[820px]">
                    <div className="ledger-card py-12 text-center">
                        <div className="border-input border-t-forest mx-auto mb-6 h-9 w-9 animate-spin rounded-full border-[3px]" />
                        <p className="text-secondary-foreground text-sm">Loading settings…</p>
                    </div>
                </div>
            </ExplorerLayout>
        );
    }

    return (
        <ExplorerLayout noHeader frameless>
            <PageMasthead
                compact
                icon="⚙️"
                title="Settings"
                subtitle={aliasName ? `The ledger for @${aliasName}` : "Your preferences"}
                backHref="/dashboard"
                backLabel="Digital Stable"
            />

            <div className="animate-fade-in-up mx-auto flex max-w-[820px] flex-col gap-6">
                {/* ── Index rail ── */}
                <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
                    {SECTIONS.map((s) => (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            className="ledger-tab mb-0 no-underline transition-[filter] hover:brightness-110"
                        >
                            {s.label}
                        </a>
                    ))}
                </nav>

                {/* ═══ Profile basics ═══ */}
                <Leaf id="profile" tab="Profile">
                    <div className="border-input mb-6 flex items-center gap-6 border-b pb-6 max-sm:gap-4">
                        <div className="border-input from-forest/5 to-saddle/5 hover:border-forest flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-[2.5px] bg-gradient-to-br text-[2rem] transition-colors [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
                            {avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatarUrl} alt="Your avatar" />
                            ) : (
                                "🐴"
                            )}
                        </div>
                        <div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={isUploadingAvatar}
                            >
                                {isUploadingAvatar ? (
                                    "Uploading…"
                                ) : (
                                    <>
                                        <Camera className="h-4 w-4" /> Change Avatar
                                    </>
                                )}
                            </Button>
                            <Input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="hidden"
                                aria-label="Upload avatar"
                            />
                            <p className="text-secondary-foreground mt-1 text-xs">
                                Max 2MB. JPG, PNG, or WebP.
                            </p>
                            {avatarError && (
                                <p className="text-destructive mt-1 text-xs" role="alert">
                                    {avatarError}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label
                            htmlFor="settings-alias"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            Display Name
                        </label>
                        <Input
                            id="settings-alias"
                            type="text"
                            value={aliasName}
                            onChange={(e) => setAliasName(e.target.value)}
                            maxLength={30}
                            minLength={3}
                        />
                        <span className="text-muted-foreground mt-1 block text-xs">
                            3–30 characters. Must be unique.
                        </span>
                    </div>

                    <div className="mb-6">
                        <label
                            htmlFor="settings-bio"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            Bio
                        </label>
                        <Textarea
                            id="settings-bio"
                            className="border-input bg-card text-foreground focus:border-forest focus:ring-forest w-full resize-y rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-1 focus:outline-none"
                            rows={3}
                            maxLength={500}
                            placeholder="Tell other collectors about yourself…"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                        />
                        <span className="text-muted-foreground mt-1 block text-xs">
                            {bio.length}/500
                        </span>
                    </div>

                    {/* Themes and profile decoration live on their own page —
                        this leaf holds identity, not appearance. */}
                    <div className="border-input bg-card/50 mb-6 rounded-lg border p-4">
                        <p className="text-secondary-foreground mb-3 text-xs leading-relaxed">
                            Profile themes, banners and the way your stable is laid out for visitors
                            are set on the customization page, not here.
                        </p>
                        <Button asChild variant="outline" size="wide">
                            <Link href="/profile/customize">
                                <Palette className="h-4 w-4" /> Customize your profile →
                            </Link>
                        </Button>
                    </div>

                    {saveControl("profile", "Save Profile")}
                </Leaf>

                {/* ═══ Notifications ═══ */}
                <Leaf id="notifications" tab="Notifications">
                    <p className="text-secondary-foreground mb-2 text-sm leading-relaxed">
                        These switch off the bell. Turning one off stops that kind of notification
                        being written at all — it will not be waiting for you later.
                    </p>

                    {NOTIFICATION_PREF_GROUPS.map((group) => (
                        <div key={group.id}>
                            <LeafHeading>
                                <span aria-hidden="true">{group.icon}</span> {group.title}
                            </LeafHeading>
                            <p className="text-muted-foreground -mt-1 mb-2 text-xs leading-relaxed">
                                {group.blurb}
                            </p>
                            {group.toggles.map((t) => (
                                <ToggleRow
                                    key={t.key}
                                    icon={t.icon}
                                    label={t.label}
                                    hint={t.hint}
                                    on={isNotifPrefOn(notifPrefs, t.key)}
                                    onToggle={() => handleToggleNotif(t.key)}
                                />
                            ))}
                            {group.alwaysOn && <AlwaysOnNote>{group.alwaysOn}</AlwaysOnNote>}
                        </div>
                    ))}

                    <p className="text-muted-foreground mt-6 text-xs">
                        Changes here save the moment you flip a switch.{" "}
                        <Link href="/notifications" className="text-forest font-semibold no-underline hover:underline">
                            See what has arrived →
                        </Link>
                    </p>
                </Leaf>

                {/* ═══ Privacy & defaults ═══ */}
                <Leaf id="privacy" tab="Privacy & Defaults">
                    <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                        What the rest of the hobby can see, and what happens by default when you add
                        a horse or a photo.
                    </p>

                    <ToggleRow
                        icon="🐎"
                        label="New horses start public"
                        hint="Off means every horse you add is private until you publish it yourself."
                        on={defaultHorsePublic}
                        onToggle={() => setDefaultHorsePublic(!defaultHorsePublic)}
                    />
                    <ToggleRow
                        icon="📸"
                        label="Watermark uploaded photos"
                        hint="Stamps your credit line onto new uploads. Existing photos are left alone."
                        on={watermarkPhotos}
                        onToggle={() => setWatermarkPhotos(!watermarkPhotos)}
                    />
                    {watermarkPhotos && (
                        <div className="border-input mt-3 mb-3 rounded-lg border border-dashed p-4">
                            <label
                                htmlFor="settings-watermark-text"
                                className="text-foreground mb-1 block text-sm font-semibold"
                            >
                                ✍️ Custom watermark text
                            </label>
                            <Input
                                id="settings-watermark-text"
                                type="text"
                                value={watermarkText}
                                onChange={(e) => setWatermarkText(e.target.value)}
                                maxLength={60}
                                placeholder={`© @${aliasName} — ModelHorseHub`}
                            />
                            <span className="text-muted-foreground mt-1 block text-xs">
                                Leave blank to use the default. Max 60 characters.
                            </span>
                        </div>
                    )}
                    <ToggleRow
                        icon="🏆"
                        label="Show your Trophy Case on your profile"
                        hint="Off hides your badges from other collectors. Your record itself is unaffected."
                        on={showBadges}
                        onToggle={() => setShowBadges(!showBadges)}
                    />
                    <ToggleRow
                        icon="🖼️"
                        label="Feature your photos on model pages"
                        hint="Off keeps your horse photos out of the community galleries on public reference pages. Your public horses still show on your own profile."
                        on={showPhotosOnReference}
                        onToggle={() => setShowPhotosOnReference(!showPhotosOnReference)}
                    />

                    <div className="mt-6">
                        <label
                            htmlFor="settings-currency"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            💱 Preferred currency symbol
                        </label>
                        <select
                            id="settings-currency"
                            className="border-input bg-card ring-offset-background focus:ring-ring flex h-10 w-full max-w-[220px] rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                            title="Select preferred currency"
                            value={currencySymbol}
                            onChange={(e) => setCurrencySymbol(e.target.value)}
                        >
                            <option value="$">$ — USD / CAD / AUD</option>
                            <option value="£">£ — British Pound</option>
                            <option value="€">€ — Euro</option>
                            <option value="¥">¥ — Yen / Yuan</option>
                            <option value="kr">kr — Krona / Krone</option>
                            <option value="CHF">CHF — Swiss Franc</option>
                            <option value="R$">R$ — Brazilian Real</option>
                            <option value="₹">₹ — Indian Rupee</option>
                            <option value="₩">₩ — Korean Won</option>
                            <option value="zł">zł — Polish Zloty</option>
                        </select>
                        <span className="text-muted-foreground mt-1 block text-xs">
                            Shown on your vault, offers and listing prices. The Blue Book always
                            quotes USD.
                        </span>
                    </div>

                    <div className="mt-6">
                        {saveControl("privacy", "Save Preferences")}
                        <span className="text-muted-foreground mt-1 block text-xs">
                            Profile, privacy and showing fields all save together — one button
                            writes the lot.
                        </span>
                    </div>
                </Leaf>

                {/* ═══ Showing ═══ */}
                <Leaf id="showing" tab="Showing">
                    <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                        Details the show ring needs from you.
                    </p>
                    <div className="mb-4">
                        <label
                            htmlFor="settings-exhibitor"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            🏷️ Exhibitor number
                        </label>
                        <Input
                            id="settings-exhibitor"
                            type="text"
                            className="max-w-[200px]"
                            value={exhibitorNumber}
                            onChange={(e) => setExhibitorNumber(e.target.value)}
                            maxLength={10}
                            placeholder="e.g. 042"
                        />
                        <span className="text-muted-foreground mt-1 block text-xs">
                            Your regional exhibitor number for live shows. Printed into show tag
                            horse numbers as XXX-YYY.
                        </span>
                    </div>
                    {saveControl("showing", "Save")}
                    <p className="text-muted-foreground mt-3 text-xs">
                        <Link href="/shows" className="text-forest font-semibold no-underline hover:underline">
                            Browse shows →
                        </Link>
                    </p>
                </Leaf>

                {/* ═══ Reports & exports ═══ */}
                <Leaf id="reports" tab="Reports & Exports">
                    <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                        Your collection, on paper. Both are generated from your live vault the
                        moment you ask — nothing is filed away in advance.
                    </p>

                    <div className="border-input flex flex-col gap-5 border-b pb-5">
                        <div>
                            <InsuranceReportButton />
                            <p className="text-secondary-foreground mt-1 text-xs leading-relaxed">
                                A professional PDF with photos, condition grades and values — scoped
                                to your whole stable or a single collection. Share it with your
                                insurance agent.
                            </p>
                        </div>
                        <div>
                            <ExportButton />
                            <p className="text-secondary-foreground mt-1 text-xs leading-relaxed">
                                Spreadsheet format, compatible with Excel and Google Sheets.
                            </p>
                        </div>
                    </div>

                    {/* Handoff: the purchased-report receipts live in the market. */}
                    <div className="mt-4">
                        <Button asChild variant="outline" size="wide">
                            <Link href="/market/reports">My reports →</Link>
                        </Button>
                        <p className="text-secondary-foreground mt-1 text-xs leading-relaxed">
                            The record of paid one-off reports you have bought, with the date of
                            each purchase.
                        </p>
                    </div>
                </Leaf>

                {/* ═══ Subscription ═══ */}
                <Leaf id="subscription" tab="Subscription">
                    <p className="mb-4 text-sm leading-relaxed">
                        <strong>MHH Pro</strong> adds advanced analytics, expanded photo storage and
                        deeper collection reports. The trust record — verified show results,
                        condition grades, Hoofprint provenance and the Blue Book — is free for
                        everyone, always.
                    </p>
                    <Link href="/upgrade" className="btn-brass">
                        View plans &amp; upgrade
                    </Link>

                    {/* Active supporters only. */}
                    {supporterLedger && (
                        <div className="border-input mt-6 border-t pt-4">
                            <SupporterLedgerToggle
                                initialListed={supporterLedger.listed}
                                label="List me on the Supporters' Ledger (About page)"
                            />
                        </div>
                    )}
                </Leaf>

                {/* ═══ Account ═══ */}
                <Leaf id="account" tab="Account">
                    <LeafHeading>Email</LeafHeading>
                    <Input
                        type="email"
                        className="max-w-[420px] opacity-60"
                        value={email}
                        disabled
                        title="Email address"
                        aria-label="Email address"
                    />
                    <span className="text-muted-foreground mt-1 block text-xs">
                        Changing your email requires verification, which is not built yet. Contact
                        us if you need it moved.
                    </span>

                    <LeafHeading>Password</LeafHeading>
                    <div className="mb-4">
                        <label
                            htmlFor="settings-current-password"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            Current password
                        </label>
                        <Input
                            id="settings-current-password"
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="The one you sign in with now"
                            className="sm:max-w-[calc(50%-0.5rem)]"
                        />
                    </div>
                    <div className="mb-4 grid gap-4 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="settings-new-password"
                                className="text-foreground mb-1 block text-sm font-semibold"
                            >
                                New password
                            </label>
                            <Input
                                id="settings-new-password"
                                type="password"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                minLength={8}
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="settings-confirm-password"
                                className="text-foreground mb-1 block text-sm font-semibold"
                            >
                                Confirm password
                            </label>
                            <Input
                                id="settings-confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Type it again"
                            />
                        </div>
                    </div>
                    <Button
                        onClick={handleChangePassword}
                        disabled={
                            isSavingPassword || !currentPassword || !newPassword || !confirmPassword
                        }
                    >
                        {isSavingPassword ? "Changing…" : "Change Password"}
                    </Button>
                    {passwordMsg && (
                        <p
                            className={`mt-2 text-sm font-medium ${
                                passwordMsg.type === "success"
                                    ? "text-forest flex items-center gap-1 before:content-['✓']"
                                    : "form-error"
                            }`}
                            role="status"
                        >
                            {passwordMsg.text}
                        </p>
                    )}
                </Leaf>

                {/* ═══ Danger zone ═══
                    Its own leaf, ringed in red. Deliberately grave: the
                    consequences are spelled out before the field that unlocks
                    the button, and the button stays dead until DELETE is typed. */}
                <section
                    id="danger"
                    className="ledger-card ring-destructive/50 scroll-mt-24 ring-1"
                >
                    {/* Flat house red rather than the forest kraft: an inline
                        FLAT colour (never a gradient) so Simple Mode's no-gradient
                        rule still holds and Lamplight needs no override. */}
                    <span className="ledger-tab" style={{ background: "#9B3028" }}>
                        Danger Zone
                    </span>
                    <h2 className="text-destructive mt-1 mb-3 flex items-center gap-2 font-serif text-lg font-bold tracking-tight">
                        <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Delete this account
                    </h2>
                    <p className="mb-3 text-sm leading-relaxed">
                        Permanently delete your account. This <strong>cannot be undone</strong>, and
                        there is no grace period.
                    </p>
                    <ul className="text-secondary-foreground mb-4 list-disc pl-6 text-sm leading-[1.8]">
                        <li>Your profile is anonymized as &ldquo;[Deleted Collector]&rdquo;</li>
                        <li>Your horses are orphaned — their Hoofprint history is preserved</li>
                        <li>Pending transfers and commissions are cancelled</li>
                        <li>You are signed out and cannot log in again</li>
                    </ul>
                    <div className="mb-4 max-w-[320px]">
                        <label
                            htmlFor="delete-confirm"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            Type <strong>DELETE</strong> to confirm
                        </label>
                        <Input
                            id="delete-confirm"
                            type="text"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                            autoComplete="off"
                        />
                    </div>
                    <Button
                        variant="destructive"
                        size="wide"
                        disabled={deleteConfirm !== "DELETE" || isDeleting}
                        onClick={async () => {
                            if (deleteConfirm !== "DELETE") return;
                            setIsDeleting(true);
                            setDeleteError(null);
                            const result = await deleteAccount();
                            if (result.success) {
                                router.push("/");
                            } else {
                                setDeleteError(result.error || "Failed to delete account.");
                                setIsDeleting(false);
                            }
                        }}
                    >
                        {isDeleting ? (
                            "Deleting…"
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" /> Permanently Delete Account
                            </>
                        )}
                    </Button>
                    {deleteError && (
                        <p
                            className="text-destructive border-destructive/30 bg-destructive/10 mt-3 flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
                            role="alert"
                        >
                            {deleteError}
                        </p>
                    )}
                </section>
            </div>
        </ExplorerLayout>
    );
}
