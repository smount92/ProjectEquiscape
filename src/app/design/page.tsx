import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Design gallery — every Button/Card variant and design token in one place.
 * Open in dev; admin-only in production (same ADMIN_EMAIL gate as /admin).
 * Used for design iteration sessions; when a variant changes in
 * ui/button.tsx or ui/card.tsx, this page shows the result everywhere it
 * will apply.
 */

const VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "destructive-outline",
  "link",
] as const;

const SIZES = ["xs", "sm", "default", "wide"] as const;

const SWATCHES = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["secondary / muted", "bg-secondary"],
  ["primary (forest)", "bg-primary"],
  ["forest-dark", "bg-forest-dark"],
  ["saddle", "bg-saddle"],
  ["destructive", "bg-destructive"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["info", "bg-info"],
  ["border", "bg-border"],
  ["border-tan", "bg-border-tan"],
  ["tier-gold", "bg-tier-gold"],
  ["tier-silver", "bg-tier-silver"],
  ["tier-bronze", "bg-tier-bronze"],
  ["tier-diamond", "bg-tier-diamond"],
] as const;

export default async function DesignGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Admin-only in production (case-insensitive, matching /admin)
    if (
      !user ||
      user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()
    ) {
      notFound();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <header>
        <h1 className="font-serif text-2xl text-foreground">Design Gallery</h1>
        <p className="text-sm text-muted-foreground">
          Internal (admin-only in production). Edit <code>ui/button.tsx</code>{" "}
          / <code>ui/card.tsx</code> and watch every variant update.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Button — variants
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {VARIANTS.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
        <h3 className="text-sm font-semibold text-secondary-foreground">
          Disabled
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {VARIANTS.map((v) => (
            <Button key={v} variant={v} disabled>
              {v}
            </Button>
          ))}
        </div>
        <h3 className="text-sm font-semibold text-secondary-foreground">
          Sizes (default variant) + icon sizes
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {SIZES.map((s) => (
            <Button key={s} size={s}>
              size {s}
            </Button>
          ))}
          <Button size="icon" aria-label="icon">
            ★
          </Button>
          <Button size="icon-sm" aria-label="icon-sm">
            ★
          </Button>
          <Button size="icon-xs" aria-label="icon-xs">
            ★
          </Button>
        </div>
        <h3 className="text-sm font-semibold text-secondary-foreground">
          As link (asChild)
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/design">Link as primary</Link>
          </Button>
          <Button asChild variant="outline" size="wide">
            <Link href="/design">Link as outline wide</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Card</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Card description text.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-secondary-foreground">
                Body content with{" "}
                <span className="text-muted-foreground">muted</span> text.
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Small card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-secondary-foreground">
                Compact spacing.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Tokens</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SWATCHES.map(([name, cls]) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-md border border-input bg-card p-2"
            >
              <span
                className={`inline-block size-8 shrink-0 rounded-md border border-input ${cls}`}
              />
              <span className="text-xs text-secondary-foreground">{name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
