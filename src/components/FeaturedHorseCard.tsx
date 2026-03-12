"use client";

import Link from "next/link";
import styles from "./FeaturedHorseCard.module.css";

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
            className={`${styles.card} animate-fade-in-up`}
            id="featured-horse"
        >
            <div className={styles.image}>
                {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnailUrl} alt={horseName} loading="eager" />
                ) : (
                    <div className="horse-card-placeholder">
                        <span className="horse-card-placeholder-icon">🐴</span>
                    </div>
                )}
                <div className={styles.badge}>🌟 {title}</div>
            </div>
            <div className={styles.info}>
                <div className={styles.name}>{horseName}</div>
                <div className={styles.owner}>
                    by @{ownerAlias} · {finishType}
                </div>
                {description && (
                    <p className={styles.desc}>{description}</p>
                )}
            </div>
        </Link>
    );
}
