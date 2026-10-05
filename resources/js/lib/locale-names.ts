/** A language is listed under its own name, whatever the language of the page. */
const LocaleNames: Record<string, string> = {
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
};

export function localeName(code: string): string {
    return LocaleNames[code] ?? code;
}
