import { useId, useState } from 'react';
import GameStatementsController from '@/actions/App/Http/Controllers/Games/GameStatementsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import {
    canSaveStatements,
    StatementCount,
    StatementMaxLength,
} from '@/lib/games/two-truths';
import type { GameTruthSet } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

type Draft = { statements: string[]; lieIndex: number | null };

const emptyDraft = (): Draft => ({
    statements: Array.from({ length: StatementCount }, () => ''),
    lieIndex: null,
});

function StatementField({
    index,
    value,
    onChange,
}: {
    index: number;
    value: string;
    onChange: (value: string) => void;
}) {
    const { t } = useTrans();
    const id = useId();

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>
                {t('Statement :number', { number: index + 1 })}
            </Label>
            <Textarea
                id={id}
                value={value}
                maxLength={StatementMaxLength}
                rows={2}
                onChange={(event) => onChange(event.target.value)}
            />
            <span
                aria-hidden
                className="self-end text-xs text-muted-foreground tabular-nums"
            >
                {t(':count / :max', {
                    count: value.length,
                    max: StatementMaxLength,
                })}
            </span>
        </div>
    );
}

/**
 * "My statements" (spec §9.7): every player prepares the set a round of Two
 * truths will play; the statements reach their author only.
 */
export function TwoTruthsSetForm({ className }: { className?: string }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const lieLegendId = useId();
    const { room, truthSets } = ctx.snapshot;

    if (truthSets === null || truthSets === undefined) {
        return null;
    }

    const mine = truthSets.mine;
    const editing = draft ?? (mine === null ? emptyDraft() : null);

    const save = async (toSave: Draft) => {
        setBusy(true);

        let response: { mine: GameTruthSet } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ mine: GameTruthSet }>(
                    GameStatementsController.update(room.id),
                    {
                        statements: toSave.statements.map((statement) =>
                            statement.trim(),
                        ),
                        lie_index: toSave.lieIndex,
                    },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        setDraft(null);
        ctx.dispatch({ type: 'statements.mine', mine: response.mine });
    };

    const remove = async () => {
        setBusy(true);

        let result: null | undefined;

        try {
            result = await ctx.run(
                retroRequest<null>(GameStatementsController.destroy(room.id)),
            );
        } finally {
            setBusy(false);
        }

        if (result === undefined) {
            return;
        }

        ctx.dispatch({ type: 'statements.mine', mine: null });
    };

    return (
        <Card
            data-slot="two-truths-set-form"
            className={cn('w-full gap-4 p-5 text-left', className)}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-title">{t('My statements')}</h3>
                {editing === null && mine !== null && (
                    <Badge
                        variant={mine.played ? 'muted' : 'success'}
                        shape="pill"
                    >
                        {mine.played ? t('Played') : t('Statements ready')}
                    </Badge>
                )}
            </div>
            {editing !== null ? (
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (
                            canSaveStatements(
                                editing.statements,
                                editing.lieIndex,
                            )
                        ) {
                            void save(editing);
                        }
                    }}
                >
                    {editing.statements.map((statement, index) => (
                        <StatementField
                            key={index}
                            index={index}
                            value={statement}
                            onChange={(value) =>
                                setDraft({
                                    ...editing,
                                    statements: editing.statements.map(
                                        (known, position) =>
                                            position === index ? value : known,
                                    ),
                                })
                            }
                        />
                    ))}
                    <fieldset className="flex flex-col gap-2">
                        <legend
                            id={lieLegendId}
                            className="mb-2 text-sm font-medium"
                        >
                            {t('Which one is the lie?')}
                        </legend>
                        <RadioGroup
                            aria-labelledby={lieLegendId}
                            value={
                                editing.lieIndex === null
                                    ? ''
                                    : String(editing.lieIndex)
                            }
                            onValueChange={(value) =>
                                setDraft({
                                    ...editing,
                                    lieIndex: Number(value),
                                })
                            }
                            className="flex flex-wrap gap-4"
                            options={editing.statements.map((_, index) => ({
                                value: String(index),
                                label: t('Statement :number', {
                                    number: index + 1,
                                }),
                            }))}
                        />
                    </fieldset>
                    <div className="flex flex-wrap justify-end gap-2">
                        {mine !== null && (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => setDraft(null)}
                            >
                                {t('Cancel')}
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={
                                busy ||
                                !canSaveStatements(
                                    editing.statements,
                                    editing.lieIndex,
                                )
                            }
                        >
                            {t('Save')}
                        </Button>
                    </div>
                </form>
            ) : (
                mine !== null && (
                    <>
                        <ol className="flex flex-col gap-2">
                            {mine.statements.map((statement, index) => (
                                <li
                                    key={index}
                                    className="flex min-w-0 items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm"
                                >
                                    <span className="min-w-0 flex-1 break-words">
                                        {statement}
                                    </span>
                                    {index === mine.lieIndex && (
                                        <Badge
                                            variant="destructive"
                                            shape="pill"
                                        >
                                            {t('Lie')}
                                        </Badge>
                                    )}
                                </li>
                            ))}
                        </ol>
                        <div className="flex flex-wrap justify-end gap-2">
                            {mine.played ? (
                                <Button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setDraft(emptyDraft())}
                                >
                                    {t('Write new ones')}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => void remove()}
                                    >
                                        {t('Remove')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() =>
                                            setDraft({
                                                statements: [
                                                    ...mine.statements,
                                                ],
                                                lieIndex: mine.lieIndex,
                                            })
                                        }
                                    >
                                        {t('Edit')}
                                    </Button>
                                </>
                            )}
                        </div>
                    </>
                )
            )}
        </Card>
    );
}
