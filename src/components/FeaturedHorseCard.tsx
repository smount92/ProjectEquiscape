"use client";

import Link from "next/link";

interface FeaturedHorseCardProps {
    horseId: string;
    horseName: string;
    title: string;
    description: string | null;
    ownerAlias: string;
    thumbnailUrl: string | null;
    finishType: string;
}

export default function FeaturedHorseCard({
    horseId,
    horseName,
    title,
    description,
    ownerAlias,
    thumbnailUrl,
    finishType,
}: FeaturedHorseCardProps) {
    return (
        <Link
            href={`/community/${horseId}`}
            className="flex max-sm:flex-col gap-8 p-8 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(234,179,8,0.03))] border border-[rgba(245,158,11,0.2)] rounded-lg mb-8 no-underline text-inherit transition-all duration-300 overflow-hidden hover:border-[rgba(245,158,11,0.4)] hover:shadow-[0_4px_24px_rgba(245,158,11,0.12)] hover:-translate-y-0.5 animate-fade-in-up"
            id="featured-horse"
        >
            <div className="relative w-[200px] max-sm:w-full h-[200px] max-sm:h-[180px] shrink-0 rounded-md overflow-hidden">
                {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnailUrl} alt={horseName} loading="eager" className="w-full h-full object-contain bg-black/15" />
                ) : (
                    <div className="horse-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-placeholder">
                        <span className="horse-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-placeholder-icon">🐴</span>
                    </div>
                )}
                <div className="absolute top-2 left-2 py-1 px-2.5 bg-[linear-gradient(135deg,#F59E0B,#D97706)] text-white text-[0.7rem] font-bold rounded-sm whitespace-nowrap">🌟 {title}</div>
            </div>
            <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="text-[1.4rem] font-bold mb-1">{horseName}</div>
                <div className="text-sm text-muted mb-4">
                    by @{ownerAlias} · {finishType}
                </div>
                {description && (
                    <p className="text-sm text-muted italic leading-relaxed m-0">{description}</p>
                )}
            </div>
        </Link>
    );
}

