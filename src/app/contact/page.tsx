"use client";

import { useActionState } from"react";
import { submitContactForm, type ContactFormState } from"@/app/actions/contact";
import { useRef, useEffect } from"react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div className="animate-fade-in-up">
 {/* Page Header */}
 <div className="mb-8">
 <h1>
 <span className="text-forest">Contact</span> Us
 </h1>
 <p className="mt-2 text-lg text-muted">
 Have a question, suggestion, or just want to say hello? We&apos;d love to hear from you.
 </p>
 </div>

 <section className="mb-12">
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
 className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
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
 <label htmlFor="contact-name" className="text-ink mb-1 block text-sm font-semibold">
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
 <label htmlFor="contact-email" className="text-ink mb-1 block text-sm font-semibold">
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
 <label htmlFor="contact-subject" className="text-ink mb-1 block text-sm font-semibold">
 Subject <span className="text-muted font-normal">(optional)</span>
 </label>
 <Input
 id="contact-subject"
 name="subject"
 type="text"
 
 placeholder="How can we help?"
 />
 </div>

 <div className="mb-6">
 <label htmlFor="contact-message" className="text-ink mb-1 block text-sm font-semibold">
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

 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 id="contact-submit"
 disabled={isPending}
 >
 {isPending ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
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
