"use client";

import { useCallback } from "react";

interface ChipToggleProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  id: string;
}

/**
 * Reusable multi-select chip toggle component.
 * WCAG: role=checkbox, aria-checked, keyboard navigable, 44px touch targets.
 */
export default function ChipToggle({ label, options, selected, onChange, id }: ChipToggleProps) {
  const toggle = useCallback(
    (option: string) => {
      if (selected.includes(option)) {
        onChange(selected.filter((s) => s !== option));
      } else {
        onChange([...selected, option]);
      }
    },
    [selected, onChange]
  );

  return (
    <div className="mb-4">
      <span className="text-stone-900 mb-2 block text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              id={`${id}-${option.toLowerCase().replace(/[\s/]+/g, "-")}`}
              className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all sm:min-h-0 sm:min-w-0 ${
                isSelected
                  ? "border-forest bg-forest/5 font-semibold text-forest"
                  : "border-[#E0D5C1] bg-[#FEFCF8] text-stone-600 hover:border-stone-400"
              }`}
              onClick={() => toggle(option)}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  toggle(option);
                }
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
