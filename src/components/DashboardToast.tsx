"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./DashboardToast.module.css";

const TOAST_MESSAGES: Record<string, { icon: string; message: (name?: string) => string }> = {
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
};

export default function DashboardToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [toastType, setToastType] = useState<string | null>(null);
  const [toastName, setToastName] = useState<string | null>(null);

  useEffect(() => {
    const toast = searchParams.get("toast");
    const name = searchParams.get("name");

    if (toast && TOAST_MESSAGES[toast]) {
      setToastType(toast);
      setToastName(name);
      setVisible(true);

      // Clean up the URL query params without a full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("toast");
      url.searchParams.delete("name");
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
      <span className={styles.msg}>{message(toastName ?? undefined)}</span>
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
