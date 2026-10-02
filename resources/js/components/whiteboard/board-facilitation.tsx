import { Lock, LockOpen, Presentation } from 'lucide-react';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import { FacilitatorBar } from '@/components/skrum/facilitator-bar';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { BoardTimer } from './board-timer';

/** Timer, board lock and follow-me: the facilitator's tools. */
export function BoardFacilitation({
    state,
    compact = false,
    className,
}: {
    state: WhiteboardState;
    compact?: boolean;
    className?: string;
}) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const { board } = state.snapshot;

    const updateSettings = async (
        settings: Record<string, boolean>,
    ): Promise<void> => {
        const done = await request(
            retroRequest(
                WhiteboardSettingsController.update(board.id),
                settings,
            ),
        );

        if (done !== undefined) {
            await state.refetch();
        }
    };

    return (
        <FacilitatorBar
            compact={compact}
            className={cn('shrink-0 flex-nowrap', className)}
            start={<BoardTimer state={state} controls />}
            actions={[
                {
                    id: 'lock',
                    kind: 'toggle',
                    pressed: board.locked,
                    label: board.locked
                        ? t('Unlock the board')
                        : t('Lock the board'),
                    icon: board.locked ? Lock : LockOpen,
                    onSelect: () =>
                        void updateSettings({ locked: !board.locked }),
                },
                {
                    id: 'follow',
                    kind: 'toggle',
                    pressed: board.followEnabled,
                    label: t('Bring everyone to me'),
                    icon: Presentation,
                    onSelect: () =>
                        void updateSettings({
                            follow_enabled: !board.followEnabled,
                        }),
                },
            ]}
        />
    );
}
