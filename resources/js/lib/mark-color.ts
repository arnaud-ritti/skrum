/**
 * The mark of a team or of a workspace has no colour of its own on the
 * server: it takes one of the eight column colours, always the same for an id.
 */
const MarkColorClasses = [
    'col-coral',
    'col-lagoon',
    'col-iris',
    'col-moss',
    'col-apricot',
    'col-sky',
    'col-plum',
    'col-sun',
] as const;

export function markColorClass(id: string): string {
    let sum = 0;

    for (const character of id) {
        sum += character.codePointAt(0) ?? 0;
    }

    return MarkColorClasses[sum % MarkColorClasses.length];
}
