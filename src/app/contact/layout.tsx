import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact — Model Horse Hub",
    description:
        "Get in touch with the Model Horse Hub team. We'd love to hear your questions, suggestions, and feedback.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
