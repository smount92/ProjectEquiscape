"use client";

import { useActionState } from "react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { useRef, useEffect } from "react";

const initialState: ContactFormState = {
    error: null,
    success: false,
};

export default function ContactPage() {
    const [state, formAction, isPending] = useActionState(submitContactForm, initialState);
    const formRef = useRef<HTMLFormElement>(null);

    // Clear the form on success
    useEffect(() => {
        if (state.success && formRef.current) {
            formRef.current.reset();
        }
    }, [state.success]);

    return (
        <div className="min-h-[calc(100vh - var(--header-height))] py-[var(--space-3xl)] px-8">
            <div className="min-h-[calc(100vh - var(--header-height))] py-[var(--space-3xl)] px-8-inner animate-fade-in-up">
                {/* Page Header */}
                <div className="min-h-[calc(100vh - var(--header-height))] py-[var(--space-3xl)] px-8-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                    <h1>
                        <span className="text-forest">Contact</span> Us
                    </h1>
                    <p className="min-h-[calc(100vh - var(--header-height))] py-[var(--space-3xl)] px-8-lead">
                        Have a question, suggestion, or just want to say hello? We&apos;d love to hear from
                        you.
                    </p>
                </div>

                <section className="mb-[var(--space-3xl)]">
                    {state.success ? (
                        <div className="text-center py-16 px-8" id="contact-success">
                            <span className="block text-[3rem] mb-6" aria-hidden="true">✅</span>
                            <h2>Message Sent!</h2>
                            <p>
                                Thanks for reaching out. We&apos;ll get back to you as soon as possible.
                            </p>
                        </div>
                    ) : (
                        <form
                            ref={formRef}
                            action={formAction}
                            className="max-w-[560px] mx-auto"
                            id="contact-form"
                            noValidate
                        >
                            {state.error && (
                                <div className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm" role="alert" id="contact-error">
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
                                <label htmlFor="contact-name" className="block text-sm font-semibold text-ink mb-1">
                                    Your Name
                                </label>
                                <input
                                    id="contact-name"
                                    name="name"
                                    type="text"
                                    className="form-input"
                                    placeholder="Jane Doe"
                                    required
                                    autoComplete="name"
                                    maxLength={200}
                                />
                            </div>

                            <div className="mb-6">
                                <label htmlFor="contact-email" className="block text-sm font-semibold text-ink mb-1">
                                    Email Address
                                </label>
                                <input
                                    id="contact-email"
                                    name="email"
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>

                            <div className="mb-6">
                                <label htmlFor="contact-subject" className="block text-sm font-semibold text-ink mb-1">
                                    Subject <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
                                </label>
                                <input
                                    id="contact-subject"
                                    name="subject"
                                    type="text"
                                    className="form-input"
                                    placeholder="How can we help?"
                                />
                            </div>

                            <div className="mb-6">
                                <label htmlFor="contact-message" className="block text-sm font-semibold text-ink mb-1">
                                    Message
                                </label>
                                <textarea
                                    id="contact-message"
                                    name="message"
                                    className="form-input resize-y min-h-[140px]"
                                    placeholder="Tell us what's on your mind..."
                                    rows={6}
                                    required
                                    maxLength={5000}
                                />
                            </div>

                            <button
                                type="submit"
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm flex w-full"
                                id="contact-submit"
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <>
                                        <span className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-spinner" aria-hidden="true" />
                                        Sending…
                                    </>
                                ) : (
                                    "Send Message"
                                )}
                            </button>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
}
