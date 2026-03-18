"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./DashboardToast.module.css";

const TOAST_MESSAGES: Record<string, { icon: string; message: (name?: string, photos?: string) => string }> = {
  deleted: {
    icon: "🗑️",
    message: (name) =>
      name
        ? `"${name}" has been permanently removed from your stable.`
        : "Horse has been permanently removed from your stable.",
  },
  updated: {
    icon: "✅",
    message: (name) =>
      name
        ? `"${name}" has been updated successfully.`
        : "Horse details updated successfully.",
  },
  photos_updated: {
    icon: "📸",
    message: (name, photos) => {
      const count = photos ? parseInt(photos) : 0;
      const photoText = count === 1 ? "1 new photo" : `${count} new photos`;
      return name
        ? `"${name}" updated — ${photoText} saved!`
        : `Horse updated — ${photoText} saved!`;
    },
  },
  photo_error: {
    icon: "⚠️",
    message: (name, _photos) =>
      name
        ? `"${name}" saved, but some photos failed to upload. Please try adding them again.`
        : "Horse saved, but some photos failed to upload. Please try again.",
  },
};

export default function DashboardToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [toastType, setToastType] = useState<string | null>(null);
  const [toastName, setToastName] = useState<string | null>(null);

  const [toastPhotos, setToastPhotos] = useState<string | null>(null);

  useEffect(() => {
    const toast = searchParams.get("toast");
    const name = searchParams.get("name");
    const photos = searchParams.get("photos");

    if (toast && TOAST_MESSAGES[toast]) {
      setToastType(toast);
      setToastName(name);
      setToastPhotos(photos);
      setVisible(true);

      // Clean up the URL query params without a full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("toast");
      url.searchParams.delete("name");
      url.searchParams.delete("photos");
      window.history.replaceState({}, "", url.pathname);

      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  if (!visible || !toastType || !TOAST_MESSAGES[toastType]) return null;

  const { icon, message } = TOAST_MESSAGES[toastType];

  return (
    <div className={styles.success} role="status" aria-live="polite">
      <span className={styles.icon}>{icon}</span>
      <span className={styles.msg}>{message(toastName ?? undefined, toastPhotos ?? undefined)}</span>
      <button
        className={styles.close}
        onClick={() => setVisible(false)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
