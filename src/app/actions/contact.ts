"use server";

import { createClient } from "@/lib/supabase/server";

export interface ContactFormState {
    error: string | null;
    success: boolean;
}

export async function submitContactForm(
    _prevState: ContactFormState,
    formData: FormData
): Promise<ContactFormState> {
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim() || null;
    const message = (formData.get("message") as string)?.trim();

    // Server-side validation
    if (!name || !email || !message) {
        return { error: "Please fill in all required fields.", success: false };
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

    const supabase = await createClient();

    const { error } = await supabase.from("contact_messages").insert({
        name,
        email,
        subject,
        message,
    });

    if (error) {
        console.error("Contact form insert error:", error);
        return { error: "Something went wrong. Please try again later.", success: false };
    }

    return { error: null, success: true };
}
