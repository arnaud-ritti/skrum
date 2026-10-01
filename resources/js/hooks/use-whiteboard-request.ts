import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError } from '@/lib/retro/api';

/**
 * Runs a request and says why it failed. Resolves to the response (null for
 * a 204), or to undefined after the toast.
 */
export function useWhiteboardRequest() {
    const { t } = useTrans();

    return useCallback(
        async <T>(request: Promise<T>): Promise<T | undefined> => {
            try {
                return await request;
            } catch (error) {
                toast.error(
                    error instanceof RetroRequestError && error.status > 0
                        ? error.message
                        : t('Something went wrong. Please try again.'),
                );

                return undefined;
            }
        },
        [t],
    );
}
