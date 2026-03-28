import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
    icon?: React.ElementType;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
}

export default function EmptyState({
    icon: Icon = PackageOpen,
    title,
    description,
    actionLabel,
    actionHref,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-16">
            <Icon size={64} className="mb-4 text-stone-300" />
            <h3 className="mb-2 font-serif text-xl font-semibold text-ink">
                {title}
            </h3>
            <p className="mb-6 max-w-sm text-center text-muted">{description}</p>
            {actionLabel && actionHref && (
                <Button asChild>
                    <Link href={actionHref}>{actionLabel}</Link>
                </Button>
            )}
        </div>
    );
}
