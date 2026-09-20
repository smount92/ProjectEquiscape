import { countryName, flagEmoji } from "@/lib/geo/countries";

/**
 * A member's country as flag + name. The name is always printed because
 * emoji flags do not render on Windows (the two letters show instead),
 * and because a flag alone is a quiz.
 */
export default function CountryTag({ code, className = "" }: { code: string | null | undefined; className?: string }) {
    const name = countryName(code);
    if (!name) return null;
    const flag = flagEmoji(code);
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`} title={name}>
            {flag && (
                <span aria-hidden="true" className="leading-none">
                    {flag}
                </span>
            )}
            <span>{name}</span>
        </span>
    );
}
