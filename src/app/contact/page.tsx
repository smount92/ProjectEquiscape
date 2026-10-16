import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { optionalAuth } from "@/lib/auth";
import { initialContactCategory } from "@/lib/contact/categories";
import { logger } from "@/lib/logger";
import ContactForm, { type ContactPrefill } from "./ContactForm";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A signed-in member's name and email, so they don't type what we know. */
async function readPrefill(): Promise<ContactPrefill> {
    try {
        const { supabase, user } = await optionalAuth();
        if (!user) return { name: "", email: "" };
        const { data } = await supabase.from("users").select("full_name, alias_name").eq("id", user.id).maybeSingle();
        const row = data as { full_name: string | null; alias_name: string | null } | null;
        return {
            name: (row?.full_name?.trim() || row?.alias_name || "").slice(0, 200),
            email: user.email ?? "",
        };
    } catch (err) {
        // The form still works empty; never let a prefill read break it.
        logger.error("Contact", "Prefill read failed", err);
        return { name: "", email: "" };
    }
}

/**
 * /contact. Read on the server so the form arrives ready: the error
 * page's reference (?ref=), the category a link asked for (?category=,
 * checked against the list) and, for a signed-in member, their name and
 * email.
 */
export default async function ContactPage({
    searchParams,
}: {
    searchParams: Promise<{ ref?: string | string[]; category?: string | string[] }>;
}) {
    const params = await searchParams;
    const rawRef = first(params.ref) ?? "";
    const errorRef = /^[A-Za-z0-9_-]{1,100}$/.test(rawRef) ? rawRef : "";
    const category = initialContactCategory(first(params.category), !!errorRef);
    const prefill = await readPrefill();

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="✉️"
                title="Contact Us"
                subtitle="Questions, suggestions, or just to say hello"
            />
            <ContactForm errorRef={errorRef} initialCategory={category} prefill={prefill} />
        </FocusLayout>
    );
}
