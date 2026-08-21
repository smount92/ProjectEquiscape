/**
 * The stable's nameplate — one leather band, the same idiom as the
 * barn's GroupMasthead and the passport's.
 *
 * BANNER LEGIBILITY. A member-supplied banner is the one place where
 * an arbitrary image sits under the cream text ramp, so it never
 * touches the text layer: the photo goes in an absolutely-positioned
 * layer at reduced opacity UNDER a two-stop scrim, and the content
 * sits above both. A blown-out white sky therefore still reads as a
 * dark leather band with cream type — the same contrast an
 * uncustomized profile has. There is no configuration that turns the
 * scrim off.
 */

import type { CSSProperties, ReactNode } from "react";

export default function ProfileMasthead({
    alias,
    avatarUrl,
    bannerUrl,
    memberSince,
    tagline,
    pronouns,
    bio,
    isOwnProfile,
    themeStyle,
    badges,
    actions,
}: {
    alias: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    memberSince: string;
    tagline: string | null;
    pronouns: string | null;
    bio: string | null;
    isOwnProfile: boolean;
    /** Custom-property bag from the member's chosen theme. */
    themeStyle?: CSSProperties;
    /** Supporter plaque, star grade — anything that sits under the name. */
    badges?: ReactNode;
    /** Follow / message / browse controls. */
    actions?: ReactNode;
}) {
    return (
        <header
            className="leather-panel stitched animate-fade-in-up relative overflow-hidden rounded-[14px] px-6 pt-8 pb-9 text-center"
            style={themeStyle}
        >
            {bannerUrl && (
                <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={bannerUrl}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,.65) 100%)",
                        }}
                    />
                </>
            )}

            <div className="relative z-[1]">
                <div className="brass-medallion mx-auto mb-3">
                    {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt={alias} className="h-full w-full object-cover" />
                    ) : (
                        <span aria-hidden="true">{alias.charAt(0).toUpperCase()}</span>
                    )}
                </div>

                <h1 className="text-engraved-light mb-1 font-serif text-[clamp(1.5rem,4vw,2.3rem)] font-bold tracking-[0.13em] text-balance uppercase">
                    {alias}
                    {isOwnProfile && (
                        <span className="bg-forest ml-3 inline-flex rounded-sm px-2 py-[2px] align-middle text-xs font-bold tracking-wider text-white uppercase">
                            You
                        </span>
                    )}
                </h1>

                <div className="font-serif text-[0.78rem] tracking-[0.2em] uppercase text-(--leather-text-soft)">
                    @{alias}
                    {pronouns && <> · {pronouns}</>} · Member since {memberSince}
                </div>

                {tagline && (
                    <p className="mx-auto mt-2 mb-0 max-w-[46ch] font-serif text-[0.95rem] tracking-wide text-(--leather-text)">
                        &ldquo;{tagline}&rdquo;
                    </p>
                )}

                {badges}

                {bio && (
                    <p className="mx-auto mt-3 mb-0 max-w-[52ch] text-[0.92rem] italic text-(--leather-text)">
                        {bio}
                    </p>
                )}

                {actions && (
                    <div className="masthead-cta mt-5 flex flex-wrap items-center justify-center gap-3">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}
