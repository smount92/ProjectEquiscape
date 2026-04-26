"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { PhotoDetail } from "@/app/actions/photos";
import { getFriendlyPhotoUrl } from "@/lib/utils/storage";

interface PhotoShareViewProps {
  photo: PhotoDetail;
}

export default function PhotoShareView({ photo }: PhotoShareViewProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = getFriendlyPhotoUrl(photo.shortSlug);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.horseName,
          text: photo.catalogRef
            ? `${photo.horseName} (${photo.catalogRef})`
            : photo.horseName,
          url: shareUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopyLink();
    }
  }, [photo, shareUrl, handleCopyLink]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <nav className="text-stone-500 mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <Link href="/community" className="hover:underline">Show Ring</Link>
        <span aria-hidden="true" className="text-stone-300">/</span>
        <Link href={`/community/${photo.horseId}`} className="hover:underline">{photo.horseName}</Link>
        <span aria-hidden="true" className="text-stone-300">/</span>
        <span className="text-stone-700">Photo</span>
      </nav>

      {/* Main Photo Card */}
      <div className="overflow-hidden rounded-2xl border border-input bg-card shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={`${photo.horseName} — ${photo.angleProfile}`}
          className="w-full object-contain bg-muted"
          style={{ maxHeight: "70vh" }}
        />

        {/* Info bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-input px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-stone-900">{photo.horseName}</h1>
            {photo.catalogRef && (
              <p className="text-sm text-stone-500">{photo.catalogRef}</p>
            )}
            {photo.finishType && (
              <span className="mt-1 inline-block rounded-full border border-input bg-muted px-2.5 py-0.5 text-xs font-medium text-stone-600">
                {photo.finishType}
              </span>
            )}
            <p className="text-xs text-stone-400 mt-1">
              Shared by <strong className="text-stone-600">{photo.ownerAlias}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleNativeShare}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg
                         border border-input bg-card px-4 py-2 text-sm font-semibold
                         text-stone-700 shadow-sm transition-all hover:bg-muted"
              title="Share this photo"
            >
              📤 Share
            </button>
            <button
              onClick={handleCopyLink}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg
                         border border-input bg-card px-4 py-2 text-sm font-semibold
                         text-stone-700 shadow-sm transition-all hover:bg-muted"
              title="Copy link"
            >
              {copied ? "✅ Copied!" : "🔗 Copy Link"}
            </button>
            <Link
              href={`/community/${photo.horseId}`}
              className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border-0
                         bg-forest px-4 py-2 text-sm font-semibold text-white no-underline
                         shadow-sm transition-all hover:opacity-90"
            >
              View Passport →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
