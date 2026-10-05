const elidableWords = 'de|que|le|la|je|ne|se|jusque|lorsque|puisque';
const elidingStart = /^[aeiouàâäæéèêëîïôöœùûü]/iu;

/**
 * French elision of a placeholder: "Tour de :name" with Inès reads "Tour d'Inès". An h is left alone:
 * the app cannot tell a mute h from an aspirated one, and a URL starts with an h too.
 * App\Support\ElidingTranslator applies the same rule on the back end.
 */
export function elide(
    line: string,
    replacements: Record<string, string | number>,
): string {
    return Object.entries(replacements).reduce((elided, [name, value]) => {
        if (typeof value !== 'string' || !elidingStart.test(value)) {
            return elided;
        }

        const placeholder = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const beforePlaceholder = new RegExp(
            `(?<!\\p{L})(${elidableWords}) (?=:${placeholder}(?![\\p{L}\\d_]))`,
            'giu',
        );

        return elided.replace(
            beforePlaceholder,
            (_, word: string) => `${word.slice(0, -1)}'`,
        );
    }, line);
}
