"use client";

/**
 * The headless half of the form engine.
 *
 * Replaces roughly 120 `useState` hooks across the add and edit forms with
 * one value bag keyed by `FieldSpec.name`. Everything derived — what's
 * visible, what's required, what's still missing, whether Save can fire —
 * is asked of the registry rather than recomputed by hand, so the four
 * copies of the required rule have nowhere to come back.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssetCategory } from "@/lib/types/database";
import { getActiveGroups, getMissingRequiredFields, getVisibleFields } from "@/lib/forms/rules";
import { validateForm } from "@/lib/forms/schema";
import type { FieldContext, FieldGroup, FormMode, FormValues } from "@/lib/forms/types";

export interface UseHorseFormOptions {
    mode: FormMode;
    category: AssetCategory;
    initialValues?: FormValues;
}

export function useHorseForm({ mode, category, initialValues }: UseHorseFormOptions) {
    const [values, setValues] = useState<FormValues>(() => ({ ...initialValues }));
    /** Fields the user has been TOLD are missing — drives the error tone. */
    const [flagged, setFlagged] = useState<string[]>([]);
    const [shake, setShake] = useState(false);

    const context: FieldContext = useMemo(
        () => ({ category, mode, values }),
        [category, mode, values],
    );

    const setValue = useCallback((name: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        // Clear a field's flag the moment the user touches it.
        setFlagged((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : prev));
    }, []);

    const setMany = useCallback((patch: FormValues) => {
        setValues((prev) => ({ ...prev, ...patch }));
    }, []);

    const reset = useCallback(
        (next?: FormValues) => {
            setValues({ ...(next ?? initialValues) });
            setFlagged([]);
        },
        [initialValues],
    );

    const missing = useMemo(() => getMissingRequiredFields(context), [context]);
    const visibleFields = useMemo(() => getVisibleFields(context), [context]);
    const activeGroups = useMemo<FieldGroup[]>(() => getActiveGroups(context), [context]);
    const canSubmit = missing.length === 0;

    /**
     * Flag every empty required field, shake them, and focus the first.
     * Returns true when the form was already complete.
     */
    const flagMissing = useCallback((): boolean => {
        if (missing.length === 0) {
            setFlagged([]);
            return true;
        }
        setFlagged(missing.map((m) => m.name));
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return false;
    }, [missing]);

    /** Full validation, including value shape — what Save asks. */
    const validate = useCallback(() => validateForm(context, values), [context, values]);

    // ── Dirty guard: warn before a hard unload loses entered work ──
    // SPA links are safe; beforeunload only fires for real unloads.
    const dirtyRef = useRef(false);
    const suppressRef = useRef(false);
    useEffect(() => {
        dirtyRef.current = Object.entries(values).some(([key, v]) => {
            if (initialValues && initialValues[key] === v) return false;
            if (typeof v === "string") return v.trim() !== "";
            if (Array.isArray(v)) return v.length > 0;
            return v !== undefined && v !== null && v !== false;
        });
    }, [values, initialValues]);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!dirtyRef.current || suppressRef.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, []);

    /** Called around a submit so the guard doesn't fire on our own navigation. */
    const suppressDirtyGuard = useCallback((on: boolean) => {
        suppressRef.current = on;
    }, []);

    return {
        values,
        setValue,
        setMany,
        reset,
        context,
        visibleFields,
        activeGroups,
        missing,
        flagged,
        shake,
        canSubmit,
        flagMissing,
        validate,
        suppressDirtyGuard,
    };
}

export type HorseForm = ReturnType<typeof useHorseForm>;
