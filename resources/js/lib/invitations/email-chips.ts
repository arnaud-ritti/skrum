export type EmailChip = { value: string; isValid: boolean };

/** As many addresses as the server takes in one request. */
export const MaxInvitationAddresses = 20;

export function splitAddresses(text: string): string[] {
    return text.split(/[\s,;]+/).filter((part) => part !== '');
}

/** Trimmed and lower case, as the server's `LoginAddress::normalise`. */
export function normaliseAddress(address: string): string {
    return address.trim().toLowerCase();
}

export function isPlausibleAddress(address: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

export function addChips(chips: EmailChip[], text: string): EmailChip[] {
    const next = [...chips];

    for (const part of splitAddresses(text)) {
        const value = normaliseAddress(part);

        if (next.length >= MaxInvitationAddresses) {
            break;
        }

        if (next.some((chip) => chip.value === value)) {
            continue;
        }

        next.push({ value, isValid: isPlausibleAddress(value) });
    }

    return next;
}

export function removeChip(chips: EmailChip[], value: string): EmailChip[] {
    return chips.filter((chip) => chip.value !== value);
}
