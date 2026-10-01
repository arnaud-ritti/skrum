/** The canvas's language codes for skrum's locales. */
export const CanvasLocales: Record<string, string> = {
    en: 'en',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
};

export function subscribeToTheme(onChange: () => void) {
    const observer = new MutationObserver(onChange);

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    });

    return () => observer.disconnect();
}

export const isDark = () => document.documentElement.classList.contains('dark');
