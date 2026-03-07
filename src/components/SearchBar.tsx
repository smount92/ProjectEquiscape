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
    placeholder = "Search by name, mold, release, or sculptor\u2026",
    id = "search-bar",
}: SearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Keyboard shortcut: "/" to focus
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === "/" &&
                !["INPUT", "TEXTAREA", "SELECT"].includes(
                    (e.target as HTMLElement)?.tagName
                )
            ) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div className={`search-bar ${isFocused ? "search-bar-focused" : ""}`} id={id}>
            {/* Search icon */}
            <svg
                className="search-bar-icon"
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
                className="search-bar-input"
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
                    className="search-bar-clear"
                    onClick={() => {
                        onChange("");
                        inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    type="button"
                >
                    <svg
                        width="16"
                        height="16"
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
                <kbd className="search-bar-kbd">/</kbd>
            )}
        </div>
    );
}
