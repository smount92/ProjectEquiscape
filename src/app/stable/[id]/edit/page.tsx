"use client";

import EditHorseEngine from "@/components/forms/engine/EditHorseEngine";

/**
 * Edit a horse. The form engine has been the only path since
 * NEXT_PUBLIC_FORM_ENGINE went to 1 in production; the legacy editor
 * that used to sit behind the flag was deleted on 2026-09-20.
 */
export default function EditHorsePage() {
    return <EditHorseEngine />;
}
