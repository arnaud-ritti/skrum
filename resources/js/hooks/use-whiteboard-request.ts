import { useCallback } from 'react';
import { toast } from 'sonner';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';

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

/** Sends a change of the board's settings, then reloads the board. Resolves to whether it went through. */
export function useUpdateWhiteboardSettings(
    state: WhiteboardState,
): (patch: Record<string, unknown>) => Promise<boolean> {
    const request = useWhiteboardRequest();

    return async (patch) => {
        const done = await request(
            retroRequest(
                WhiteboardSettingsController.update(state.snapshot.board.id),
                patch,
            ),
        );

        if (done === undefined) {
            return false;
        }

        await state.refetch();

        return true;
    };
}
