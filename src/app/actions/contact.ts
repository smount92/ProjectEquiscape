"use server";

import { after } from "next/server";
import { logger } from "@/lib/logger";
import { optionalAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { isContactCategory } from "@/lib/contact/categories";

export interface ContactFormState {
    error: string | null;
    success: boolean;
}

/** Columns migration 236 adds; dropped from the insert until it is pasted. */
const TRIAGE_COLUMNS = ["category", "user_id", "error_ref"] as const;

function isMissingTriageColumn(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    return (
        (error.code === "42703" || error.code === "PGRST204") &&
        TRIAGE_COLUMNS.some((c) => (error.message ?? "").includes(c))
    );
}

/**
 * Submit a message via the public contact form.
 * Stores it for the owner, with what it's about, the error reference if the
 * sender came from an error page, and their account if they are signed in
 * (MHH-027), and rings the owner's bell (MHH-021).
 */
export async function submitContactForm(_prevState: ContactFormState, formData: FormData): Promise<ContactFormState> {
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim() || null;
    const message = (formData.get("message") as string)?.trim();
    const rawCategory = (formData.get("category") as string)?.trim();
    const category = isContactCategory(rawCategory) ? rawCategory : "question";
    const rawRef = ((formData.get("error_ref") as string) ?? "").trim();
    const errorRef = /^[A-Za-z0-9_-]{1,100}$/.test(rawRef) ? rawRef : null;

    // Server-side validation
    if (!name || !email || !message) {
        return { error: "Please fill in all required fields.", success: false };
    }

    // Rate limit: 5 submissions per 60 minutes per IP
    const allowed = await checkRateLimit("contact_form", 5, 60);
    if (!allowed) {
        return { error: "Too many messages. Please try again in an hour.", success: false };
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { error: "Please enter a valid email address.", success: false };
    }

    // Length guard
    if (name.length > 200) {
        return { error: "Name is too long (max 200 characters).", success: false };
    }
    if (message.length > 5000) {
        return { error: "Message is too long (max 5,000 characters).", success: false };
    }

    const { supabase, user } = await optionalAuth();
    const row = { name, email, subject, message, category, user_id: user?.id ?? null, error_ref: errorRef };

    // Untyped until migration 236 enters the generated types.
    const db = supabase as unknown as {
        from: (t: string) => {
            insert: (r: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
        };
    };
    let { error } = await db.from("contact_messages").insert(row);
    if (error && isMissingTriageColumn(error)) {
        // Migration 236 not pasted yet: the message itself still arrives.
        ({ error } = await db.from("contact_messages").insert({ name, email, subject, message }));
    }

    if (error) {
        logger.error("Contact", "Form insert error", error);
        return { error: "Something went wrong. Please try again later.", success: false };
    }

    after(async () => {
        try {
            const { adminNotificationTargets } = await import("@/lib/notifications/adminTargets");
            const { createNotification } = await import("@/lib/notifications/createNotification");
            const { getAdminClient } = await import("@/lib/supabase/admin");
            const { contactCategoryOwnerLabel } = await import("@/lib/contact/categories");
            for (const ownerId of await adminNotificationTargets(getAdminClient())) {
                await createNotification({
                    userId: ownerId,
                    type: "system",
                    actorId: user?.id ?? null,
                    content: `✉️ New message from ${name} (${contactCategoryOwnerLabel(category)})${subject ? `: ${subject.slice(0, 100)}` : ""}`,
                    linkUrl: "/admin#mailbox",
                });
            }
        } catch (err) {
            logger.error("Contact", "Owner notice failed", err);
        }
    });

    return { error: null, success: true };
}
