import { RetroRequestError } from '@/lib/retro/api';

export function integrationErrorMessage(
    error: unknown,
    fallback: string,
): string {
    if (error instanceof RetroRequestError && error.status !== 0) {
        return error.message;
    }

    return fallback;
}
