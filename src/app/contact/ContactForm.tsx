"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { CONTACT_CATEGORIES, type ContactCategory } from "@/lib/contact/categories";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const initialState: ContactFormState = {
    error: null,
    success: false,
};

export interface ContactPrefill {
    name: string;
    email: string;
}

const LABEL = "mb-1 block text-sm font-semibold text-foreground";

/**
 * The contact form. It submits through onSubmit rather than
 * `<form action>`: React 19 resets a form after its action runs, even when
 * the action failed, which wiped everything the member had typed whenever
 * sending went wrong. The browser checks required fields and the email
 * shape before anything is sent.
 */
export default function ContactForm({
    errorRef,
    initialCategory,
    prefill,
}: {
    /** The error page's reference, already checked; "" when none. */
    errorRef: string;
    initialCategory: ContactCategory;
    prefill: ContactPrefill;
}) {
    const [state, dispatch, isPending] = useActionState(submitContactForm, initialState);
    const [category, setCategory] = useState<string>(initialCategory);
    const successHeading = useRef<HTMLHeadingElement>(null);

    // Take focus to the confirmation, so a keyboard or screen-reader user
    // hears it rather than being left on a button that no longer exists.
    useEffect(() => {
        if (state.success) successHeading.current?.focus();
    }, [state.success]);

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => dispatch(data));
    };

    if (state.success) {
        return (
            <section>
                <div className="px-8 py-16 text-center" id="contact-success" role="status">
                    <span className="mb-6 block text-[3rem]" aria-hidden="true">
                        ✅
                    </span>
                    <h2 ref={successHeading} tabIndex={-1} className="outline-none">
                        Thanks, we have your message
                    </h2>
                    <p>We&apos;ll reply by email as soon as we can.</p>
                </div>
            </section>
        );
    }

    return (
        <section>
            <form onSubmit={submit} className="mx-auto max-w-[560px]" id="contact-form">
                {state.error && (
                    <div
                        className="mt-2 mb-6 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
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
                            className="shrink-0"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        {state.error}
                    </div>
                )}

                <div className="mb-6">
                    <label htmlFor="contact-name" className={LABEL}>
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
                        defaultValue={prefill.name}
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="contact-email" className={LABEL}>
                        Email Address
                    </label>
                    <Input
                        id="contact-email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        defaultValue={prefill.email}
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="contact-category" className={LABEL}>
                        What&apos;s this about?
                    </label>
                    <NativeSelect
                        id="contact-category"
                        name="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        aria-describedby={category === "report" ? "contact-report-hint" : undefined}
                    >
                        {CONTACT_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                    </NativeSelect>
                    {category === "report" && (
                        <p id="contact-report-hint" className="mt-2 mb-0 text-sm text-secondary-foreground">
                            To report a post or member, use the <span aria-hidden="true">🚩</span> Report button on it.
                        </p>
                    )}
                </div>

                {errorRef && (
                    <p className="mb-6 rounded-md border border-input bg-muted px-3 py-2 text-sm text-secondary-foreground">
                        Error reference <strong className="font-mono">{errorRef}</strong> is attached, so we can find
                        what went wrong.
                        <input type="hidden" name="error_ref" value={errorRef} />
                    </p>
                )}

                <div className="mb-6">
                    <label htmlFor="contact-subject" className={LABEL}>
                        Subject <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input id="contact-subject" name="subject" type="text" placeholder="How can we help?" />
                </div>

                <div className="mb-6">
                    <label htmlFor="contact-message" className={LABEL}>
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
        </section>
    );
}
