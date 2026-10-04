import type { ActionItemStatus } from '@/lib/retro/types';

/** To do and in progress are what is left to do. */
export function isOpenStatus(status: ActionItemStatus): boolean {
    return status !== 'completed';
}
