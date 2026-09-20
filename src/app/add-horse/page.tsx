"use client";

import { Suspense } from "react";

import AddHorseEngine from "@/components/forms/engine/AddHorseEngine";

/**
 * Add a horse. The form engine has been the only path since
 * NEXT_PUBLIC_FORM_ENGINE went to 1 in production; the legacy wizard
 * that used to sit behind the flag was deleted on 2026-09-20.
 *
 * Suspense wrapper: the engine reads useSearchParams(), and without a
 * boundary that bails the whole static build ("missing-suspense-with-
 * csr-bailout").
 */
export default function AddHorsePage() {
    return (
        <Suspense fallback={null}>
            <AddHorseEngine />
        </Suspense>
    );
}
