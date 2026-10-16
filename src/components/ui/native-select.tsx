import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A plain <select> dressed like `Input`: same height, radius, border,
 * focus ring and 16px text on phones (anything smaller makes iOS zoom the
 * page). Use it for short, fixed lists inside forms, where the native
 * picker is the better phone experience; the Radix `Select` is for
 * menus that need custom rendering.
 *
 * `className` styles the wrapper (width, margins); everything else goes
 * to the <select>.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
    return (
        <div data-slot="native-select-wrapper" className={cn("relative w-full", className)}>
            <select
                data-slot="native-select"
                className="h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-card py-1 pr-9 pl-2.5 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&>option]:bg-card [&>option]:text-foreground"
                {...props}
            >
                {children}
            </select>
            <ChevronDownIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
        </div>
    );
}

export { NativeSelect };
