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
            className="featured-horse-card animate-fade-in-up"
            id="featured-horse"
        >
            <div className="featured-horse-image">
                {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnailUrl} alt={horseName} loading="eager" />
                ) : (
                    <div className="horse-card-placeholder">
                        <span className="horse-card-placeholder-icon">🐴</span>
                    </div>
                )}
                <div className="featured-horse-badge">🌟 {title}</div>
            </div>
            <div className="featured-horse-info">
                <div className="featured-horse-name">{horseName}</div>
                <div className="featured-horse-owner">
                    by @{ownerAlias} · {finishType}
                </div>
                {description && (
                    <p className="featured-horse-desc">{description}</p>
                )}
            </div>
        </Link>
    );
}
