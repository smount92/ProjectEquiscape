"use client";

import { useState, useEffect, useRef } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import {
 getProfile,
 updateProfile,
 updateNotificationPrefs,
 changePassword,
 uploadAvatar,
 deleteAccount,
} from"@/app/actions/settings";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FocusLayout from"@/components/layouts/FocusLayout";

const NOTIF_LABELS: { key: string; emoji: string; label: string }[] = [
 { key:"show_votes", emoji:"📸", label:"Show votes on your entries" },
 { key:"favorites", emoji:"❤️", label:"Favorites on your horses" },
 { key:"comments", emoji:"💬", label:"Comments on your horses" },
 { key:"new_followers", emoji:"👥", label:"New followers" },
 { key:"messages", emoji:"✉️", label:"Messages" },
 { key:"show_results", emoji:"🏆", label:"Show results" },
 { key:"transfers", emoji:"📦", label:"Transfer notifications" },
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
 const [showBadges, setShowBadges] = useState(true);
 const [currencySymbol, setCurrencySymbol] = useState("$");
 const [profileMsg, setProfileMsg] = useState<{ type:"success" |"error"; text: string } | null>(null);
 const [isSavingProfile, setIsSavingProfile] = useState(false);

 // Notifications
 const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

 // Password
 const [newPassword, setNewPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [passwordMsg, setPasswordMsg] = useState<{ type:"success" |"error"; text: string } | null>(null);
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
 setShowBadges(profile.showBadges);
 setCurrencySymbol(profile.currencySymbol);
 setIsLoading(false);
 }
 load();
 }, [router]);

 // ── Profile save ──
 const handleSaveProfile = async () => {
 setIsSavingProfile(true);
 setProfileMsg(null);
 const result = await updateProfile({
 aliasName,
 bio,
 defaultHorsePublic,
 watermarkPhotos,
 showBadges,
 currencySymbol,
 });
 if (result.success) {
 setProfileMsg({ type:"success", text:"Profile updated!" });
 } else {
 setProfileMsg({ type:"error", text: result.error ||"Failed to save." });
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
 setPasswordMsg({ type:"success", text:"Password changed!" });
 setNewPassword("");
 setConfirmPassword("");
 } else {
 setPasswordMsg({ type:"error", text: result.error ||"Failed to change password." });
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
 setAvatarUrl(result.url +"?t=" + Date.now()); // bust cache
 }
 setIsUploadingAvatar(false);
 e.target.value ="";
 };

 if (isLoading) {
 return (
 <FocusLayout title="Settings" description="Manage your profile, notifications, and account.">
 <div className="p-12 text-center">
 <div
 className="mx-auto mb-6 h-9 w-9 animate-spin rounded-full border-3 border-stone-200 border-t-forest"
 />
 <p>Loading settings…</p>
 </div>
 </FocusLayout>
 );
 }

 return (
 <FocusLayout title="Settings" description="Manage your profile, notifications, and account.">
 <nav className="text-stone-600 animate-fade-in-up mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
 <Link href="/dashboard">Digital Stable</Link>
 <span className="separator" aria-hidden="true">
 /
 </span>
 <span>Settings</span>
 </nav>

        <div className="animate-fade-in-up max-w-[680px]">
          <h1 className="mb-12 text-2xl font-bold tracking-tight">
            ⚙️ <span className="text-forest">Settings</span>
          </h1>

 {/* ═══ Profile ═══ */}
 <div className="mb-12 max-sm:mb-8">
 <h2 className="text-stone-900 mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
 👤 Profile
 </h2>
 <div className="bg-white border-stone-200 rounded-xl border p-8 shadow-[0_1px_3px_rgb(245 245 244)] transition-shadow hover:shadow-[0_2px_8px_rgb(245 245 244)] max-sm:p-6">
 {/* Avatar */}
            <div className="mb-8 flex items-center gap-6 border-b border-stone-200 pb-6 max-sm:gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-[2.5px] border-stone-300 bg-gradient-to-br from-forest/5 to-amber-800/5 text-[2rem] transition-colors hover:border-emerald-700 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
 {avatarUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={avatarUrl} alt="Your avatar" />
 ) : (
"🐴"
 )}
 </div>
 <div>
 <button
                className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 bg-transparent px-6 py-2 text-sm font-medium text-stone-600 no-underline transition-all hover:border-emerald-700 hover:text-forest"
 onClick={() => avatarInputRef.current?.click()}
 disabled={isUploadingAvatar}
 >
 {isUploadingAvatar ?"Uploading…" :"📷 Change Avatar"}
 </button>
 <Input
 ref={avatarInputRef}
 type="file"
 accept="image/*"
 onChange={handleAvatarChange}
 className="hidden"
 aria-label="Upload avatar"
 />
              <p className="mt-1 text-xs text-stone-600">
 Max 2MB. JPG, PNG, or WebP.
 </p>
 </div>
 </div>

 {/* Alias */}
 <div className="mb-6">
 <label htmlFor="settings-alias" className="text-stone-900 mb-1 block text-sm font-semibold">
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
 <span className="text-stone-500 mt-1 block text-xs">3-30 characters. Must be unique.</span>
 </div>

 {/* Bio */}
 <div className="mb-6">
 <label htmlFor="settings-bio" className="text-stone-900 mb-1 block text-sm font-semibold">
 Bio
 </label>
 <Textarea
 id="settings-bio"
 className="w-full resize-y rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 transition-colors focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest"
 rows={3}
 maxLength={500}
 placeholder="Tell other collectors about yourself…"
 value={bio}
 onChange={(e) => setBio(e.target.value)}
 />
 <span className="text-stone-500 mt-1 block text-xs">{bio.length}/500</span>
 </div>

 {/* Default horse visibility */}
 <div className="border-stone-200 flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0 max-sm:gap-2">
 <span className="text-stone-900 flex items-center gap-2 text-sm font-medium">
 🏆 Default new horses to public
 </span>
 <button
 type="button"
 className={defaultHorsePublic ?"settings-toggle-active" :"settings-toggle"}
 onClick={() => setDefaultHorsePublic(!defaultHorsePublic)}
 aria-pressed={defaultHorsePublic}
 aria-label="Toggle default new horses to public"
 title="Toggle default horse visibility"
 />
 </div>

 {/* Photo watermarking */}
 <div className="border-stone-200 flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0 max-sm:gap-2">
 <div>
 <span className="text-stone-900 flex items-center gap-2 text-sm font-medium">
 📸 Watermark uploaded photos
 </span>
 <span className="text-stone-500 mt-1 mt-[2] block text-xs">
 Adds &ldquo;© @{aliasName} — ModelHorseHub&rdquo; to new uploads
 </span>
 </div>
 <button
 type="button"
 className={watermarkPhotos ?"settings-toggle-active" :"settings-toggle"}
 onClick={() => setWatermarkPhotos(!watermarkPhotos)}
 aria-pressed={watermarkPhotos}
 aria-label="Toggle photo watermarking"
 title="Toggle photo watermarking"
 />
 </div>

 {/* Show trophies on profile */}
 <div className="border-stone-200 flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0 max-sm:gap-2">
 <div>
 <span className="text-stone-900 flex items-center gap-2 text-sm font-medium">
 🏆 Show Trophy Case on profile
 </span>
 <span className="text-stone-500 mt-1 mt-[2] block text-xs">
 When off, your badges are hidden from other users
 </span>
 </div>
 <button
 type="button"
 className={showBadges ?"settings-toggle-active" :"settings-toggle"}
 onClick={() => setShowBadges(!showBadges)}
 aria-pressed={showBadges}
 aria-label="Toggle Trophy Case on profile"
 title="Toggle Trophy Case visibility"
 />
 </div>

 {/* Currency symbol preference */}
 <div className="mb-6">
 <label htmlFor="settings-currency" className="text-stone-900 mb-1 block text-sm font-semibold">
 💱 Preferred Currency Symbol
 </label>
 <select
 id="settings-currency"
 className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 max-w-[200px]"
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
 <span className="text-stone-500 mt-1 block text-xs">
 Shown on your vault, offers, and listing prices. Market Value (Blue Book) always shows
 USD.
 </span>
 </div>

 <button
                className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-forest px-6 py-2.5 text-sm font-semibold text-white no-underline shadow-sm transition-all hover:bg-forest/90"
 onClick={handleSaveProfile}
 disabled={isSavingProfile}
 >
 {isSavingProfile ?"Saving…" :"Save Profile"}
 </button>

 {profileMsg && (
 <p
 className={`${profileMsg.type ==="success" ?"text-forest mt-1 flex items-center gap-1 text-sm font-medium before:content-['✓']" :"form-error"} mt-2`}
 >
 {profileMsg.text}
 </p>
 )}
 </div>
 </div>

 {/* ═══ Security ═══ */}
 <div className="mb-12 max-sm:mb-8">
 <h2 className="text-stone-900 mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
 🔒 Security
 </h2>
 <div className="bg-white border-stone-200 rounded-xl border p-8 shadow-[0_1px_3px_rgb(245 245 244)] transition-shadow hover:shadow-[0_2px_8px_rgb(245 245 244)] max-sm:p-6">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Email</label>
 <Input
 type="email"
 className="opacity-60"
 value={email}
 disabled
 title="Email address"
 />
 <span className="text-stone-500 mt-1 block text-xs">
 Email changes require verification (coming soon).
 </span>
 </div>

 <div className="mb-6">
 <label
 htmlFor="settings-new-password"
 className="text-stone-900 mb-1 block text-sm font-semibold"
 >
 New Password
 </label>
 <Input
 id="settings-new-password"
 type="password"
 
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 placeholder="At least 8 characters"
 minLength={8}
 />
 </div>

 <div className="mb-6">
 <label
 htmlFor="settings-confirm-password"
 className="text-stone-900 mb-1 block text-sm font-semibold"
 >
 Confirm Password
 </label>
 <Input
 id="settings-confirm-password"
 type="password"
 
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 placeholder="Type it again"
 />
 </div>

 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleChangePassword}
 disabled={isSavingPassword || !newPassword || !confirmPassword}
 >
 {isSavingPassword ?"Changing…" :"Change Password"}
 </button>

 {passwordMsg && (
 <p
 className={`${passwordMsg.type ==="success" ?"text-forest mt-1 flex items-center gap-1 text-sm font-medium before:content-['✓']" :"form-error"} mt-2`}
 >
 {passwordMsg.text}
 </p>
 )}
 </div>
 </div>

 {/* ═══ Notifications ═══ */}
 <div className="mb-12 max-sm:mb-8">
 <h2 className="text-stone-900 mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
 🔔 Notifications
 </h2>
 <div className="bg-white border-stone-200 rounded-xl border p-8 shadow-[0_1px_3px_rgb(245 245 244)] transition-shadow hover:shadow-[0_2px_8px_rgb(245 245 244)] max-sm:p-6">
 {NOTIF_LABELS.map((n) => (
 <div
 key={n.key}
 className="border-stone-200 flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0 max-sm:gap-2"
 >
 <span className="text-stone-900 flex items-center gap-2 text-sm font-medium">
 {n.emoji} {n.label}
 </span>
 <button
 type="button"
 className={notifPrefs[n.key] ?"settings-toggle-active" :"settings-toggle"}
 onClick={() => handleToggleNotif(n.key)}
 aria-pressed={notifPrefs[n.key]}
 aria-label={`Toggle ${n.label}`}
 title={`Toggle ${n.label}`}
 />
 </div>
 ))}
 </div>
 </div>

 {/* ═══ Data & Reports ═══ */}
 <div className="mb-12 max-sm:mb-8">
 <h2 className="text-stone-900 mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
 📊 Data & Reports
 </h2>
 <div className="bg-white border-stone-200 rounded-xl border p-8 shadow-[0_1px_3px_rgb(245 245 244)] transition-shadow hover:shadow-[0_2px_8px_rgb(245 245 244)] max-sm:p-6">
 <div className="flex flex-col gap-6">
 {/* CSV Export */}
 <div>
 <a
 href="/api/export"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 download
 >
 📄 Download Collection (CSV)
 </a>
 <p className="text-stone-600 mt-1 mt-[4] block text-xs">
 Spreadsheet format — compatible with Excel, Google Sheets.
 </p>
 </div>

 {/* Insurance PDF */}
 <div>
 <a
 href="/api/insurance-report"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 download
 >
 🛡️ Download Insurance Report (PDF)
 </a>
 <p className="text-stone-600 mt-1 mt-[4] block text-xs">
 Professional PDF with photos and values — share with your insurance agent.
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* ═══ Subscription ═══ */}
 <div className="mb-12 max-sm:mb-8">
 <h2 className="text-stone-900 mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
 💎 Subscription
 </h2>
 <div className="bg-white border-stone-200 rounded-xl border p-8 shadow-[0_1px_3px_rgb(245 245 244)] transition-shadow hover:shadow-[0_2px_8px_rgb(245 245 244)] max-sm:p-6">
 <p className="mb-4 text-sm leading-[1.6]">
 Upgrade to <strong>MHH Pro</strong> for advanced analytics, expanded photo storage,
 AI-powered collection reports, and more.
 </p>
 <Link
  href="/upgrade"
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-bold text-white no-underline shadow-sm transition-all hover:from-amber-600 hover:to-orange-600"
 >
  💎 View Plans & Upgrade
 </Link>
 </div>
 </div>

 {/* ═══ Danger Zone ═══ */}
 <div className="mb-12 max-sm:mb-8">
 <h2 className="text-stone-900 mb-4 flex items-center gap-2 text-lg font-bold tracking-tight text-[#ef4444]">
 ⚠️ Danger Zone
 </h2>
 <div
 className="bg-white rounded-xl border border-[#ef4444] p-8 shadow-[0_1px_3px_rgb(245 245 244)] transition-shadow hover:shadow-[0_2px_8px_rgb(245 245 244)] max-sm:p-6"
 >
 <p className="mb-4 leading-[1.6]">
 Permanently delete your account. This action <strong>cannot be undone</strong>.
 </p>
 <ul className="text-stone-500 mb-4 pl-6 text-sm leading-[1.8]">
 <li>Your profile will be anonymized as &ldquo;[Deleted Collector]&rdquo;</li>
 <li>Your horses will be orphaned (Hoofprint™ history preserved)</li>
 <li>Pending transfers and commissions will be cancelled</li>
 <li>You will be signed out and cannot log in again</li>
 </ul>
 <div className="mb-6">
 <label htmlFor="delete-confirm" className="text-stone-900 mb-1 block text-sm font-semibold">
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
 <button
 className={`inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md border border-stone-200 px-6 py-2 text-sm font-semibold no-underline transition-all ${
 deleteConfirm ==="DELETE"
 ? "cursor-pointer bg-[#ef4444] text-white"
 : "cursor-not-allowed bg-stone-50 text-stone-500"
 }`}
 disabled={deleteConfirm !=="DELETE" || isDeleting}
 onClick={async () => {
 if (deleteConfirm !=="DELETE") return;
 setIsDeleting(true);
 setDeleteError(null);
 const result = await deleteAccount();
 if (result.success) {
 router.push("/");
 } else {
 setDeleteError(result.error ||"Failed to delete account.");
 setIsDeleting(false);
 }
 }}
 >
 {isDeleting ?"Deleting…" :"🗑️ Permanently Delete Account"}
 </button>
 {deleteError && (
 <p className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 {deleteError}
 </p>
 )}
 </div>
 </div>
 </div>
 </FocusLayout>
 );
}
