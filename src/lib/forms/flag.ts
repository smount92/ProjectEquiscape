/**
 * Form engine feature flag. Ships dark: set NEXT_PUBLIC_FORM_ENGINE=1 to
 * render the new premium forms. Off (the default) leaves the three legacy
 * files serving every route exactly as they do today.
 *
 * Mirrors src/lib/shows/flags.ts — only the literal "1" turns it on.
 */
export function formEngineEnabled(): boolean {
    return process.env.NEXT_PUBLIC_FORM_ENGINE === "1";
}
