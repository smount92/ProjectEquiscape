"use client";

/**
 * The step rail — index tabs across the top of the ledger.
 *
 * The old indicator was a row of numbered dots joined by a line: generic
 * wizard chrome. These are kraft index tabs. The one you are writing on
 * carries a brass fore-edge; the ones behind you turn forest and take a
 * stamped tick; the ones ahead stay pale kraft, and are disabled while a
 * required field on the current leaf is still empty — which is the same
 * rule the Next button asks, from the same place.
 */

export interface RailStep {
    key: string;
    label: string;
    icon?: string;
}

export default function StepRail({
    steps,
    current,
    furthestReachable,
    onJump,
}: {
    steps: RailStep[];
    current: number;
    /**
     * The highest index the user may jump to. Everything past it is a leaf
     * they have not earned yet.
     */
    furthestReachable: number;
    onJump: (index: number) => void;
}) {
    return (
        <nav className="fe-rail mb-6 max-sm:flex-wrap" aria-label="Form progress">
            {steps.map((step, i) => {
                const state = i === current ? "current" : i < current ? "done" : "todo";
                const reachable = i <= furthestReachable;
                return (
                    <button
                        key={step.key}
                        type="button"
                        data-state={state}
                        disabled={!reachable}
                        aria-current={i === current ? "step" : undefined}
                        aria-label={`Step ${i + 1}: ${step.label}`}
                        onClick={() => reachable && onJump(i)}
                        className="fe-rail-tab max-sm:min-w-[calc(50%-3px)] max-sm:flex-none"
                    >
                        <span className="fe-rail-num" aria-hidden="true">
                            {state === "done" ? "✓" : i + 1}
                        </span>
                        <span>{step.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
