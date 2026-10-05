function getInitial(name: string): string {
    return Array.from(name)[0] ?? '';
}

export function getInitials(fullName: string): string {
    const names = fullName.trim().split(/\s+/u).filter(Boolean);

    if (names.length === 0) {
        return '';
    }

    if (names.length === 1) {
        return getInitial(names[0]).toUpperCase();
    }

    const firstInitial = getInitial(names[0]);
    const lastInitial = getInitial(names[names.length - 1]);

    return `${firstInitial}${lastInitial}`.toUpperCase();
}

/** A nickname is often one word: its first two letters then, as the mockups draw "Nadia" as "NA". */
export function getNicknameInitials(nickname: string): string {
    const names = nickname.trim().split(/\s+/u).filter(Boolean);

    if (names.length !== 1) {
        return getInitials(nickname);
    }

    return Array.from(names[0]).slice(0, 2).join('').toUpperCase();
}
