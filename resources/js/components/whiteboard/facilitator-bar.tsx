import { AlarmClock, Lock, LockOpen, Presentation, Vote } from 'lucide-react';
import { useState } from 'react';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import WhiteboardTimersController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTimersController';
import WhiteboardVoteClosuresController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteClosuresController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import { VoteDialog } from './vote-dialog';

const Minutes = [1, 3, 5, 10];

type Props = { state: WhiteboardState; api: ExcalidrawImperativeAPI | null };

/** Timer, board lock, follow-me and vote: the facilitator's tools. */
export function FacilitatorBar({ state, api }: Props) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const [busy, setBusy] = useState(false);
    const [startingVote, setStartingVote] = useState(false);
    const { board, voting } = state.snapshot;

    const setTimer = async (seconds: number | null) => {
        setBusy(true);

        const response = await request(
            retroRequest<{ timerEndsAt: string | null }>(
                WhiteboardTimersController.update(board.id),
                { seconds },
            ),
        );

        setBusy(false);

        if (response !== undefined) {
            state.setTimer(response.timerEndsAt);
        }
    };

    const updateSettings = async (settings: Record<string, boolean>) => {
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

    const closeVote = async (sessionId: string) => {
        const done = await request(
            retroRequest(
                WhiteboardVoteClosuresController.store({
                    board: board.id,
                    voteSession: sessionId,
                }),
            ),
        );

        if (done !== undefined) {
            await state.refetch();
        }
    };

    return (
        <div
            role="toolbar"
            aria-label={t('Facilitation tools')}
            className="flex items-center gap-1"
        >
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label={t('Timer')}>
                        <AlarmClock className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {Minutes.map((minutes) => (
                        <DropdownMenuItem
                            key={minutes}
                            disabled={busy}
                            onSelect={() => void setTimer(minutes * 60)}
                        >
                            {t(':count min', { count: minutes })}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={busy || board.timerEndsAt === null}
                        onSelect={() => void setTimer(null)}
                    >
                        {t('Stop timer')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button
                size="sm"
                variant={board.locked ? 'default' : 'outline'}
                aria-pressed={board.locked}
                aria-label={t(
                    board.locked ? 'Unlock the board' : 'Lock the board',
                )}
                title={t(board.locked ? 'Unlock the board' : 'Lock the board')}
                onClick={() => void updateSettings({ locked: !board.locked })}
            >
                {board.locked ? (
                    <Lock className="size-4" />
                ) : (
                    <LockOpen className="size-4" />
                )}
            </Button>
            <Button
                size="sm"
                variant={board.followEnabled ? 'default' : 'outline'}
                aria-pressed={board.followEnabled}
                aria-label={t('Bring everyone to me')}
                title={t('Bring everyone to me')}
                onClick={() =>
                    void updateSettings({
                        follow_enabled: !board.followEnabled,
                    })
                }
            >
                <Presentation className="size-4" />
            </Button>
            {voting?.open ? (
                <Button size="sm" onClick={() => void closeVote(voting.id)}>
                    {t('Close the vote')}
                </Button>
            ) : (
                <Button
                    size="sm"
                    variant="outline"
                    aria-label={t('Start a vote')}
                    title={t('Start a vote')}
                    disabled={api === null}
                    onClick={() => setStartingVote(true)}
                >
                    <Vote className="size-4" />
                </Button>
            )}
            {api && (
                <VoteDialog
                    state={state}
                    api={api}
                    open={startingVote}
                    onOpenChange={setStartingVote}
                />
            )}
        </div>
    );
}
