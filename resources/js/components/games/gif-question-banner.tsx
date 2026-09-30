import { Pencil, Shuffle } from 'lucide-react';
import { useState } from 'react';
import GameQuestionsController from '@/actions/App/Http/Controllers/Games/GameQuestionsController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const MaxQuestionLength = 200;

/** The host can shuffle or rewrite the question until the first answer (spec §4.2). */
export function GifQuestionBanner({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const canChange =
        ctx.snapshot.room.isHost &&
        round.revealedAt === null &&
        (round.answers ?? []).length === 0 &&
        !round.myAnswer;

    const save = async (text?: string) => {
        setBusy(true);

        let response: { question: string } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ question: string }>(
                    GameQuestionsController.update({
                        room: ctx.snapshot.room.id,
                        round: round.id,
                    }),
                    text === undefined ? {} : { text },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        ctx.dispatch({
            type: 'question.changed',
            roundId: round.id,
            question: response.question,
        });
        setEditing(false);
    };

    return (
        <div className="rounded-lg border bg-muted/40 p-4 text-center">
            {editing ? (
                <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save(draft.trim());
                    }}
                >
                    <Input
                        value={draft}
                        maxLength={MaxQuestionLength}
                        aria-label={t('Question')}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button
                        type="submit"
                        disabled={busy || draft.trim() === ''}
                    >
                        {t('Save')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditing(false)}
                    >
                        {t('Cancel')}
                    </Button>
                </form>
            ) : (
                <p className="text-lg font-semibold">{round.question}</p>
            )}
            {canChange && !editing && (
                <div className="mt-3 flex justify-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void save()}
                    >
                        <Shuffle className="size-4" />
                        {t('Shuffle question')}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            setDraft(round.question ?? '');
                            setEditing(true);
                        }}
                    >
                        <Pencil className="size-4" />
                        {t('Edit question')}
                    </Button>
                </div>
            )}
        </div>
    );
}
