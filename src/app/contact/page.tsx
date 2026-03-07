"use client";

import { useState } from "react";

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Non-functional placeholder — in production this would call an API
        setSubmitted(true);
    };

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
                    {submitted ? (
                        <div className="contact-success" id="contact-success">
                            <span className="contact-success-icon" aria-hidden="true">✅</span>
                            <h2>Message Sent!</h2>
                            <p>
                                Thanks for reaching out. We&apos;ll get back to you as soon as possible.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="contact-form" id="contact-form">
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
                                    Subject
                                </label>
                                <input
                                    id="contact-subject"
                                    name="subject"
                                    type="text"
                                    className="form-input"
                                    placeholder="How can we help?"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="contact-message" className="form-label">
                                    Message
                                </label>
                                <textarea
                                    id="contact-message"
                                    name="message"
                                    className="form-input contact-textarea"
                                    placeholder="Tell us what's on your mind..."
                                    rows={6}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-full"
                                id="contact-submit"
                            >
                                Send Message
                            </button>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
}
