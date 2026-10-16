"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { useRef, useEffect } from "react";
import { CONTACT_CATEGORIES } from "@/lib/contact/categories";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";

const initialState: ContactFormState = {
    error: null,
    success: false,
};

// The reference an error page sends along (?ref=...), so the member never
// has to type it. useSearchParams needs a Suspense boundary for the build.
export default function ContactPage() {
    return (
        <Suspense fallback={null}>
            <ContactForm />
        </Suspense>
    );
}

function ContactForm() {
    const params = useSearchParams();
    const rawRef = params.get("ref") ?? "";
    const errorRef = /^[A-Za-z0-9_-]{1,100}$/.test(rawRef) ? rawRef : "";
    const [state, formAction, isPending] = useActionState(submitContactForm, initialState);
    const formRef = useRef<HTMLFormElement>(null);

    // Clear the form on success
    useEffect(() => {
        if (state.success && formRef.current) {
            formRef.current.reset();
        }
    }, [state.success]);

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="✉️"
                title="Contact Us"
                subtitle="Questions, suggestions, or just to say hello"
            />
            <section>
                {state.success ? (
                    <div className="px-8 py-16 text-center" id="contact-success">
                        <span className="mb-6 block text-[3rem]" aria-hidden="true">
                            ✅
                        </span>
                        <h2>Message Sent!</h2>
                        <p>Thanks for reaching out. We&apos;ll get back to you as soon as possible.</p>
                    </div>
                ) : (
                    <form
                        ref={formRef}
                        action={formAction}
                        className="mx-auto max-w-[560px]"
                        id="contact-form"
                        noValidate
                    >
                        {state.error && (
                            <div
                                className="mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                                role="alert"
                                id="contact-error"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                {state.error}
                            </div>
                        )}

                        <div className="mb-6">
                            <label htmlFor="contact-name" className="mb-1 block text-sm font-semibold text-foreground">
                                Your Name
                            </label>
                            <Input
                                id="contact-name"
                                name="name"
                                type="text"
                                placeholder="Jane Doe"
                                required
                                autoComplete="name"
                                maxLength={200}
                            />
                        </div>

                        <div className="mb-6">
                            <label htmlFor="contact-email" className="mb-1 block text-sm font-semibold text-foreground">
                                Email Address
                            </label>
                            <Input
                                id="contact-email"
                                name="email"
                                type="email"
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="mb-6">
                            <label
                                htmlFor="contact-category"
                                className="mb-1 block text-sm font-semibold text-foreground"
                            >
                                What&apos;s this about?
                            </label>
                            <select
                                id="contact-category"
                                name="category"
                                defaultValue={errorRef ? "problem" : "question"}
                                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                            >
                                {CONTACT_CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {errorRef && (
                            <p className="mb-6 rounded-md border border-input bg-muted px-3 py-2 text-sm text-secondary-foreground">
                                Error reference <strong className="font-mono">{errorRef}</strong> is attached, so we can
                                find what went wrong.
                                <input type="hidden" name="error_ref" value={errorRef} />
                            </p>
                        )}

                        <div className="mb-6">
                            <label
                                htmlFor="contact-subject"
                                className="mb-1 block text-sm font-semibold text-foreground"
                            >
                                Subject <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            <Input id="contact-subject" name="subject" type="text" placeholder="How can we help?" />
                        </div>

                        <div className="mb-6">
                            <label
                                htmlFor="contact-message"
                                className="mb-1 block text-sm font-semibold text-foreground"
                            >
                                Message
                            </label>
                            <Textarea
                                id="contact-message"
                                name="message"
                                className="min-h-[140px] resize-y"
                                placeholder="Tell us what's on your mind..."
                                rows={6}
                                required
                                maxLength={5000}
                            />
                        </div>

                        <Button type="submit" id="contact-submit" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <span
                                        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                                        aria-hidden="true"
                                    />
                                    Sending…
                                </>
                            ) : (
                                "Send Message"
                            )}
                        </Button>
                    </form>
                )}
            </section>
        </FocusLayout>
    );
}
