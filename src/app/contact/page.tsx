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
        <div className="static-page">
            <div className="static-page-inner animate-fade-in-up">
                {/* Page Header */}
                <div className="static-page-header">
                    <h1>
                        <span className="text-gradient">Contact</span> Us
                    </h1>
                    <p className="static-page-lead">
                        Have a question, suggestion, or just want to say hello? We&apos;d love to hear from
                        you.
                    </p>
                </div>

                <section className="static-section">
                    {state.success ? (
                        <div className="text-center py-3xl px-xl" id="contact-success">
                            <span className="block text-[3rem] mb-lg" aria-hidden="true">✅</span>
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
                                <div className="form-error" role="alert" id="contact-error">
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

                            <div className="form-group">
                                <label htmlFor="contact-name" className="form-label">
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

                            <div className="form-group">
                                <label htmlFor="contact-email" className="form-label">
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

                            <div className="form-group">
                                <label htmlFor="contact-subject" className="form-label">
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

                            <div className="form-group">
                                <label htmlFor="contact-message" className="form-label">
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
                                className="btn btn-primary btn-full"
                                id="contact-submit"
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <>
                                        <span className="btn-spinner" aria-hidden="true" />
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
