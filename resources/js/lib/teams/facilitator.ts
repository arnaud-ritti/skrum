import type { FacilitatorOption } from '@/types';

/** The person the retro form preselects: the suggestion while it is one of the options, else the viewer. */
export function initialFacilitatorId(
    options: FacilitatorOption[],
    suggestedId: string | null,
    viewerId: string,
): string {
    if (
        suggestedId !== null &&
        options.some((option) => option.id === suggestedId)
    ) {
        return suggestedId;
    }

    return viewerId;
}

/** The viewer first, then the others in the server's order (already alphabetical). */
export function facilitatorChoices(
    options: FacilitatorOption[],
    viewerId: string,
): FacilitatorOption[] {
    const viewer = options.filter((option) => option.id === viewerId);

    return [...viewer, ...options.filter((option) => option.id !== viewerId)];
}
