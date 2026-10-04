import { router } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import {
    IcebreakerGameCard,
    IcebreakerGameGrid,
} from '@/components/skrum/icebreaker-game-card';
import { SessionFormFooter } from '@/components/teams/session-create/new-session-dialog';
import type {
    IcebreakerSessionForm,
    SessionFormContext,
} from '@/components/teams/session-create/new-session-dialog';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { GameCatalogue } from '@/lib/games/catalogue';
import type { GameKind, GameRoomAccess } from '@/lib/games/types';
import type { GameOption } from '@/types';
import { FieldError } from '@/components/teams/session-create/field-error';

export type IcebreakerSessionFormProps = {
    workspaceSlug: string;
    gameOptions: GameOption[];
    /** The type is shown disabled with this reason: see `roomLimitReason`. */
    disabledReason?: string;
    /** Name the form opens with. Default: empty. */
    initialName?: string;
    /** Beside "Create & open". A later plan passes "Schedule…" here. */
    secondaryAction?: ReactNode;
};

type Errors = Record<string, string>;

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

/** The icebreaker form of the creation dialog, as `NewSessionDialog` takes it. */
export function icebreakerSessionForm(
    props: IcebreakerSessionFormProps,
): IcebreakerSessionForm {
    return {
        disabledReason: props.disabledReason,
        render: (context) => (
            <IcebreakerSessionFields {...props} context={context} />
        ),
    };
}

/** Why the Icebreaker type cannot be chosen: the team has as many rooms as it may have. */
export function roomLimitReason(
    canCreateGameRoom: boolean,
    roomLimit: number,
    t: Translate,
): string | undefined {
    if (canCreateGameRoom) {
        return undefined;
    }

    return t('This team already has :count game rooms.', { count: roomLimit });
}

function usePitches(): Record<GameKind, string> {
    const { t } = useTrans();

    return {
        draw: t('One draws, the others guess.'),
        hangman: t('Guess the word, letter by letter.'),
        gif: t('Sum up the sprint with a single GIF.'),
        decoded: t('One writes it in emojis, the others guess.'),
        two_truths: t('Everyone prepares three statements, one lie: find it.'),
        mood: t('Your mood as a weather, anonymously.'),
        guess_who: t(
            'Everyone answers, one answer is drawn: guess who wrote it.',
        ),
        quick_question: t('One question, everyone answers aloud in turn.'),
    };
}

export function IcebreakerSessionFields({
    workspaceSlug,
    gameOptions,
    initialName = '',
    secondaryAction,
    context,
}: IcebreakerSessionFormProps & {
    context: SessionFormContext;
}): ReactElement {
    const { t } = useTrans();
    const pitches = usePitches();
    const [name, setName] = useState(initialName);
    const [picked, setPicked] = useState<GameKind | null>(null);
    const [access, setAccess] = useState<GameRoomAccess>('team');
    const [errors, setErrors] = useState<Errors>({});
    const [processing, setProcessing] = useState(false);
    const available = gameOptions.filter((option) => option.available);
    const game =
        available.find((option) => option.value === picked)?.value ??
        available[0]?.value ??
        null;

    const submit = (event: FormEvent): void => {
        event.preventDefault();

        if (processing || game === null) {
            return;
        }

        if (name.trim() === '') {
            setErrors({ name: t('The name is required.') });

            return;
        }

        setErrors({});

        router.post(
            TeamGameRoomsController.store({
                workspace: workspaceSlug,
                team: context.team.id,
            }).url,
            { name, game, access },
            {
                onStart: () => setProcessing(true),
                onSuccess: () => context.close(),
                onError: (failed) => setErrors(failed),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <form
            id={context.formId}
            data-slot="icebreaker-session-fields"
            onSubmit={submit}
            className="grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]"
        >
            <div className="flex min-w-0 flex-col gap-4 px-4 py-5 md:px-6">
                <div className="grid gap-2">
                    <Label htmlFor="new-icebreaker-name">{t('Name')}</Label>
                    <Input
                        id="new-icebreaker-name"
                        value={name}
                        maxLength={60}
                        required
                        autoFocus
                        aria-invalid={errors.name !== undefined || undefined}
                        aria-describedby={
                            errors.name === undefined
                                ? undefined
                                : 'new-icebreaker-name-error'
                        }
                        onChange={(event) => setName(event.target.value)}
                    />
                    <FieldError
                        id="new-icebreaker-name-error"
                        message={errors.name}
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <span className="truncate text-sm font-semibold">
                        {t('Game')}
                    </span>
                    <IcebreakerGameGrid
                        className="gap-3"
                        aria-invalid={errors.game !== undefined || undefined}
                        aria-describedby={
                            errors.game === undefined
                                ? undefined
                                : 'new-icebreaker-game-error'
                        }
                    >
                        {gameOptions.map((option) => (
                            <IcebreakerGameCard
                                key={option.value}
                                {...GameCatalogue[option.value]}
                                game={option.value}
                                title={option.label}
                                pitch={pitches[option.value]}
                                available={option.available}
                                unavailableReason={
                                    option.value === 'gif'
                                        ? t('No GIF provider configured')
                                        : undefined
                                }
                                selected={option.value === game}
                                onSelect={setPicked}
                            />
                        ))}
                    </IcebreakerGameGrid>
                    <FieldError
                        id="new-icebreaker-game-error"
                        message={errors.game}
                    />
                </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4 border-t bg-muted/45 px-4 py-5 md:border-t-0 md:border-l md:px-6">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">{t('Access')}</span>
                    <SettingRow
                        label={t('Who can join')}
                        htmlFor="new-icebreaker-access"
                        icon={Users}
                        error={errors.access}
                    >
                        <Select
                            value={access}
                            onValueChange={(value) =>
                                setAccess(value as GameRoomAccess)
                            }
                        >
                            <SelectTrigger
                                id="new-icebreaker-access"
                                size="sm"
                                className="max-w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="team">
                                    {t('Team members only')}
                                </SelectItem>
                                <SelectItem value="link">
                                    {t('Anyone with the link')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingRow>
                </div>
            </div>

            <SessionFormFooter
                context={context}
                processing={processing}
                disabled={game === null}
                secondaryAction={secondaryAction}
            />
        </form>
    );
}
