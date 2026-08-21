"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchAliases } from "@/app/actions/posts";
import {
    findMentionQuery,
    applyMentionCompletion,
    type MentionQuery,
} from "@/lib/feed/mentionMatch";
import UserAvatar from "@/components/social/UserAvatar";

interface Suggestion {
    alias: string;
    avatarUrl: string | null;
}

interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    maxLength?: number;
    rows?: number;
    id?: string;
    className?: string;
    "aria-label"?: string;
}

/**
 * A textarea that completes @mentions.
 *
 * Aliases on this site contain spaces, so a plain textarea produced
 * mentions nobody could resolve: the author typed "@black fox farm"
 * and the server tagged a user called "black". Completing from the
 * real alias list means what gets typed is what gets stored, and the
 * longest-match parser on the other end agrees with it.
 *
 * No quoting syntax is inserted — `@black fox farm` is stored plain,
 * because the resolver understands it now.
 */
export default function MentionTextarea({
    value,
    onChange,
    placeholder,
    maxLength = 2000,
    rows = 3,
    id,
    className = "",
    "aria-label": ariaLabel,
}: MentionTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [range, setRange] = useState<MentionQuery | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [highlighted, setHighlighted] = useState(0);
    const requestSeq = useRef(0);

    const closeMenu = useCallback(() => {
        setRange(null);
        setSuggestions([]);
        setHighlighted(0);
    }, []);

    const syncQuery = useCallback((text: string, caret: number) => {
        const found = findMentionQuery(text, caret);
        setRange(found);
        if (!found) setSuggestions([]);
    }, []);

    // Debounced lookup. `requestSeq` drops out-of-order responses so a
    // slow early query can never overwrite a fast later one.
    useEffect(() => {
        if (!range) return;
        const query = range.query.trim();
        const seq = ++requestSeq.current;
        const timer = setTimeout(async () => {
            // A bare "@" opens nothing until there is something to match.
            const results = query.length < 1 ? [] : await searchAliases(query);
            if (seq !== requestSeq.current) return;
            setSuggestions(results);
            setHighlighted(0);
        }, 180);
        return () => clearTimeout(timer);
    }, [range]);

    const choose = (suggestion: Suggestion) => {
        const textarea = textareaRef.current;
        if (!range || !textarea) return;
        const caret = textarea.selectionStart ?? value.length;
        const next = applyMentionCompletion(value, range, caret, suggestion.alias);
        onChange(next.text);
        closeMenu();
        // Restore the caret after React has re-rendered the value.
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(next.caret, next.caret);
        });
    };

    const isOpen = !!range && suggestions.length > 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!isOpen) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => (h + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            choose(suggestions[highlighted]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeMenu();
        }
    };

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                id={id}
                className={
                    className ||
                    "w-full min-h-[100px] resize-y rounded-md border border-input bg-transparent px-4 py-3 text-sm no-underline transition-all focus:border-forest focus:outline-none"
                }
                placeholder={placeholder}
                value={value}
                maxLength={maxLength}
                rows={rows}
                aria-label={ariaLabel}
                aria-autocomplete="list"
                aria-controls={isOpen ? "mention-suggestions" : undefined}
                onChange={(e) => {
                    onChange(e.target.value);
                    syncQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyUp={(e) => {
                    const target = e.currentTarget;
                    syncQuery(target.value, target.selectionStart ?? target.value.length);
                }}
                onClick={(e) => {
                    const target = e.currentTarget;
                    syncQuery(target.value, target.selectionStart ?? target.value.length);
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                    // Let a click on a suggestion land before tearing the menu down.
                    setTimeout(closeMenu, 150);
                }}
            />

            {isOpen && (
                <ul
                    id="mention-suggestions"
                    role="listbox"
                    aria-label="Mention suggestions"
                    className="absolute left-2 top-full z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-input bg-card p-1 shadow-lg"
                >
                    {suggestions.map((s, i) => (
                        <li key={s.alias} role="option" aria-selected={i === highlighted}>
                            <button
                                type="button"
                                className={`flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 px-2 py-1.5 text-left text-sm ${
                                    i === highlighted ? "bg-forest text-white" : "bg-transparent text-foreground"
                                }`}
                                onMouseEnter={() => setHighlighted(i)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => choose(s)}
                            >
                                <UserAvatar src={s.avatarUrl} alias={s.alias} size="xs" />
                                <span className="truncate">@{s.alias}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
