import { Clapperboard, Pencil, Shuffle } from 'lucide-react';
import { useState } from 'react';
import GameQuestionsController from '@/actions/App/Http/Controllers/Games/GameQuestionsController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const MaxQuestionLength = 200;

type Props = {
    round: GameRound;
    /** What to do at this step, under the question. */
    hint: string;
};

/** The host can shuffle or rewrite the question until the first answer (spec §4.2). */
export function GifQuestionBanner({ round, hint }: Props) {
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
        <div
            data-slot="gif-question"
            className="flex w-full max-w-160 flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card px-4 py-3 shadow-card"
        >
            <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-md border border-skrum-col-iris-border bg-skrum-col-iris text-skrum-col-iris-text"
            >
                <Clapperboard className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
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
                        <div className="flex shrink-0 gap-2">
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
                        </div>
                    </form>
                ) : (
                    <p className="text-base font-title break-words">
                        {round.question}
                    </p>
                )}
                <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            {canChange && !editing && (
                <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void save()}
                    >
                        <Shuffle aria-hidden />
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
                        <Pencil aria-hidden />
                        {t('Edit question')}
                    </Button>
                </div>
            )}
        </div>
    );
}
