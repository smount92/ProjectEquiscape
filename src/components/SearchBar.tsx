"use client";

import { useState, useRef, useEffect } from "react";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    id?: string;
}

export default function SearchBar({
    value,
    onChange,
    placeholder = "Search by name, mold, release, or sculptor…",
    id = "search-bar",
}: SearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Keyboard shortcut: "/" to focus
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div
            className={`flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 transition-all ${isFocused ? "border-forest ring-2 ring-forest/20" : "border-input"}`}
            id={id}
        >
            {/* Search icon */}
            <svg
                className="shrink-0 text-stone-400 transition-colors"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
                ref={inputRef}
                type="text"
                className="min-w-0 flex-1 border-none bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                aria-label="Search horses"
            />

            {/* Keyboard hint or clear button */}
            {value ? (
                <button
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-input bg-muted text-stone-500 transition-all hover:bg-stone-200"
                    onClick={() => {
                        onChange("");
                        inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    type="button"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            ) : (
                <kbd className="flex h-6 items-center rounded border border-input bg-muted px-1.5 text-xs text-stone-400">
                    /
                </kbd>
            )}
        </div>
    );
}
