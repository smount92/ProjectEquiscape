"use client";

import QuickAddEngine from "@/components/forms/engine/QuickAddEngine";

/**
 * Quick add. The form engine has been the only path since
 * NEXT_PUBLIC_FORM_ENGINE went to 1 in production; the legacy quick-add
 * that used to sit behind the flag was deleted on 2026-09-20.
 */
export default function QuickAddPage() {
    return <QuickAddEngine />;
}
