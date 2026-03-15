"use client";

import { useState, useEffect, useRef } from "react";
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
import styles from "./settings.module.css";

const NOTIF_LABELS: { key: string; emoji: string; label: string }[] = [
    { key: "show_votes", emoji: "📸", label: "Show votes on your entries" },
    { key: "favorites", emoji: "❤️", label: "Favorites on your horses" },
    { key: "comments", emoji: "💬", label: "Comments on your horses" },
    { key: "new_followers", emoji: "👥", label: "New followers" },
    { key: "messages", emoji: "✉️", label: "Messages" },
    { key: "show_results", emoji: "🏆", label: "Show results" },
    { key: "transfers", emoji: "📦", label: "Transfer notifications" },
];

export default function SettingsPage() {
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
    const [currencySymbol, setCurrencySymbol] = useState("$");
    const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Notifications
    const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

    // Password
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    // Avatar upload
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // Delete account
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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
            setCurrencySymbol(profile.currencySymbol);
            setIsLoading(false);
        }
        load();
    }, [router]);

    // ── Profile save ──
    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        setProfileMsg(null);
        const result = await updateProfile({ aliasName, bio, defaultHorsePublic, watermarkPhotos, currencySymbol });
        if (result.success) {
            setProfileMsg({ type: "success", text: "Profile updated!" });
        } else {
            setProfileMsg({ type: "error", text: result.error || "Failed to save." });
        }
        setIsSavingProfile(false);
    };

    // ── Notification toggle ──
    const handleToggleNotif = async (key: string) => {
        const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
        setNotifPrefs(updated);
        await updateNotificationPrefs(updated);
    };

    // ── Password change ──
    const handleChangePassword = async () => {
        setIsSavingPassword(true);
        setPasswordMsg(null);
        const result = await changePassword({ newPassword, confirmPassword });
        if (result.success) {
            setPasswordMsg({ type: "success", text: "Password changed!" });
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
        const formData = new FormData();
        formData.set("avatar", file);
        const result = await uploadAvatar(formData);
        if (result.success && result.url) {
            setAvatarUrl(result.url + "?t=" + Date.now()); // bust cache
        }
        setIsUploadingAvatar(false);
        e.target.value = "";
    };

    if (isLoading) {
        return (
            <div className="page-container">
                <div style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                    <div
                        className="btn-spinner"
                        style={{
                            width: 36,
                            height: 36,
                            margin: "0 auto var(--space-lg)",
                            borderWidth: 3,
                            borderColor: "var(--color-border)",
                            borderTopColor: "var(--color-accent-primary)",
                        }}
                    />
                    <p>Loading settings…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <nav className="passport-breadcrumb animate-fade-in-up" aria-label="Breadcrumb">
                <Link href="/dashboard">Digital Stable</Link>
                <span className="separator" aria-hidden="true">/</span>
                <span>Settings</span>
            </nav>

            <div className="static-page-inner animate-fade-in-up" style={{ maxWidth: 680 }}>
                <h1 style={{ marginBottom: "var(--space-2xl)" }}>
                    <span className="text-gradient">⚙️ Settings</span>
                </h1>

                {/* ═══ Profile ═══ */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>👤 Profile</h2>
                    <div className={styles.card}>
                        {/* Avatar */}
                        <div className={styles.avatarRow}>
                            <div className={styles.avatar}>
                                {avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={avatarUrl} alt="Your avatar" />
                                ) : (
                                    "🐴"
                                )}
                            </div>
                            <div>
                                <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={isUploadingAvatar}
                                >
                                    {isUploadingAvatar ? "Uploading…" : "📷 Change Avatar"}
                                </button>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    style={{ display: "none" }}
                                />
                                <p style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: 4 }}>
                                    Max 2MB. JPG, PNG, or WebP.
                                </p>
                            </div>
                        </div>

                        {/* Alias */}
                        <div className="form-group">
                            <label htmlFor="settings-alias" className="form-label">
                                Display Name
                            </label>
                            <input
                                id="settings-alias"
                                type="text"
                                className="form-input"
                                value={aliasName}
                                onChange={(e) => setAliasName(e.target.value)}
                                maxLength={30}
                                minLength={3}
                            />
                            <span className="form-hint">3-30 characters. Must be unique.</span>
                        </div>

                        {/* Bio */}
                        <div className="form-group">
                            <label htmlFor="settings-bio" className="form-label">
                                Bio
                            </label>
                            <textarea
                                id="settings-bio"
                                className="form-textarea"
                                rows={3}
                                maxLength={500}
                                placeholder="Tell other collectors about yourself…"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                            />
                            <span className="form-hint">{bio.length}/500</span>
                        </div>

                        {/* Default horse visibility */}
                        <div className={styles.toggleRow}>
                            <span className={styles.toggleLabel}>
                                🏆 Default new horses to public
                            </span>
                            <button
                                type="button"
                                className={defaultHorsePublic ? styles.toggleActive : styles.toggle}
                                onClick={() => setDefaultHorsePublic(!defaultHorsePublic)}
                                aria-pressed={defaultHorsePublic}
                            />
                        </div>

                        {/* Photo watermarking */}
                        <div className={styles.toggleRow}>
                            <div>
                                <span className={styles.toggleLabel}>
                                    📸 Watermark uploaded photos
                                </span>
                                <span className="form-hint" style={{ display: "block", marginTop: 2 }}>
                                    Adds &ldquo;© @{aliasName} — ModelHorseHub&rdquo; to new uploads
                                </span>
                            </div>
                            <button
                                type="button"
                                className={watermarkPhotos ? styles.toggleActive : styles.toggle}
                                onClick={() => setWatermarkPhotos(!watermarkPhotos)}
                                aria-pressed={watermarkPhotos}
                            />
                        </div>

                        {/* Currency symbol preference */}
                        <div className="form-group">
                            <label htmlFor="settings-currency" className="form-label">
                                💱 Preferred Currency Symbol
                            </label>
                            <select
                                id="settings-currency"
                                className="form-select"
                                value={currencySymbol}
                                onChange={(e) => setCurrencySymbol(e.target.value)}
                                style={{ maxWidth: 200 }}
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
                            <span className="form-hint">
                                Shown on your vault, offers, and listing prices. Market Value (Blue Book) always shows USD.
                            </span>
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile}
                            style={{ marginTop: "var(--space-lg)" }}
                        >
                            {isSavingProfile ? "Saving…" : "Save Profile"}
                        </button>

                        {profileMsg && (
                            <p className={profileMsg.type === "success" ? styles.success : "form-error"} style={{ marginTop: "var(--space-sm)" }}>
                                {profileMsg.text}
                            </p>
                        )}
                    </div>
                </div>

                {/* ═══ Security ═══ */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🔒 Security</h2>
                    <div className={styles.card}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                disabled
                                style={{ opacity: 0.6 }}
                            />
                            <span className="form-hint">Email changes require verification (coming soon).</span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="settings-new-password" className="form-label">
                                New Password
                            </label>
                            <input
                                id="settings-new-password"
                                type="password"
                                className="form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                minLength={8}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="settings-confirm-password" className="form-label">
                                Confirm Password
                            </label>
                            <input
                                id="settings-confirm-password"
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Type it again"
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleChangePassword}
                            disabled={isSavingPassword || !newPassword || !confirmPassword}
                        >
                            {isSavingPassword ? "Changing…" : "Change Password"}
                        </button>

                        {passwordMsg && (
                            <p className={passwordMsg.type === "success" ? styles.success : "form-error"} style={{ marginTop: "var(--space-sm)" }}>
                                {passwordMsg.text}
                            </p>
                        )}
                    </div>
                </div>

                {/* ═══ Notifications ═══ */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🔔 Notifications</h2>
                    <div className={styles.card}>
                        {NOTIF_LABELS.map((n) => (
                            <div key={n.key} className={styles.toggleRow}>
                                <span className={styles.toggleLabel}>
                                    {n.emoji} {n.label}
                                </span>
                                <button
                                    type="button"
                                    className={notifPrefs[n.key] ? styles.toggleActive : styles.toggle}
                                    onClick={() => handleToggleNotif(n.key)}
                                    aria-pressed={notifPrefs[n.key]}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ═══ Data & Reports ═══ */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>📊 Data & Reports</h2>
                    <div className={styles.card}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
                            {/* CSV Export */}
                            <div>
                                <a href="/api/export" className="btn btn-ghost" download>
                                    📄 Download Collection (CSV)
                                </a>
                                <p className="form-hint" style={{ marginTop: 4 }}>
                                    Spreadsheet format — compatible with Excel, Google Sheets.
                                </p>
                            </div>

                            {/* Insurance PDF */}
                            <div>
                                <a href="/api/insurance-report" className="btn btn-primary" download>
                                    🛡️ Download Insurance Report (PDF)
                                </a>
                                <p className="form-hint" style={{ marginTop: 4 }}>
                                    Professional PDF with photos and values — share with your insurance agent.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ Danger Zone ═══ */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle} style={{ color: "#ef4444" }}>⚠️ Danger Zone</h2>
                    <div className={styles.card} style={{ border: "1px solid #ef4444", borderRadius: "var(--radius-lg)" }}>
                        <p style={{ marginBottom: "var(--space-md)", lineHeight: 1.6 }}>
                            Permanently delete your account. This action <strong>cannot be undone</strong>.
                        </p>
                        <ul style={{ marginBottom: "var(--space-md)", paddingLeft: "var(--space-lg)", lineHeight: 1.8, color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                            <li>Your profile will be anonymized as &ldquo;[Deleted Collector]&rdquo;</li>
                            <li>Your horses will be orphaned (Hoofprint™ history preserved)</li>
                            <li>Pending transfers and commissions will be cancelled</li>
                            <li>You will be signed out and cannot log in again</li>
                        </ul>
                        <div className="form-group">
                            <label htmlFor="delete-confirm" className="form-label">Type <strong>DELETE</strong> to confirm</label>
                            <input
                                id="delete-confirm"
                                type="text"
                                className="form-input"
                                value={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                placeholder="DELETE"
                                autoComplete="off"
                            />
                        </div>
                        <button
                            className="btn"
                            style={{
                                background: deleteConfirm === "DELETE" ? "#ef4444" : "var(--color-surface-elevated)",
                                color: deleteConfirm === "DELETE" ? "#fff" : "var(--color-text-muted)",
                                cursor: deleteConfirm === "DELETE" ? "pointer" : "not-allowed",
                            }}
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
                            {isDeleting ? "Deleting…" : "🗑️ Permanently Delete Account"}
                        </button>
                        {deleteError && <p className="form-error" style={{ marginTop: "var(--space-sm)" }}>{deleteError}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
