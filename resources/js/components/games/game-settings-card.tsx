import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import {
    GifVotesOptions,
    RoundsOptions,
    SettingsByGame,
    settingsPatch,
    TurnSecondsOptions,
    WordThemes,
    wordThemeLabel,
} from '@/lib/games/settings';
import type { GameSettingKey } from '@/lib/games/settings';
import type { GameKind, WordTheme } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type SettingValues = {
    wordTheme: WordTheme | null;
    categories: WordTheme[];
    turnSeconds: number | null;
    autoHints: boolean;
    takesTurns: boolean;
    roundsPerGame: number | null;
    gifVotes: number;
    gifAuthorsHidden: boolean;
    guestsAllowed: boolean;
};

const AllWords = 'all';
const Off = 'off';
const Endless = 'endless';
const MixedThemes = 'mixed';

type Translate = ReturnType<typeof useTrans>['t'];

function settingLabel(key: GameSettingKey, game: GameKind, t: Translate) {
    switch (key) {
        case 'wordTheme':
            return game === 'draw' ? t('Word list') : t('Word theme');
        case 'categories':
            return t('Categories');
        case 'turnSeconds':
            if (game === 'decoded') {
                return t('Time per round');
            }

            return game === 'quick_question'
                ? t('Time per person')
                : t('Time per turn');
        case 'autoHints':
            return t('Auto hints');
        case 'takesTurns':
            return t('Take turns');
        case 'roundsPerGame':
            return t('Rounds');
        case 'gifVotes':
            return t('Votes');
        case 'gifAuthorsHidden':
            return t('Hide authors until the votes close');
        case 'guestsAllowed':
            return t('Guests allowed');
    }
}

function SettingRow({
    id,
    label,
    children,
}: {
    id: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
            <label
                htmlFor={id}
                data-slot="setting-label"
                className="min-w-0 truncate"
            >
                {label}
            </label>
            {children}
        </div>
    );
}

const selectClass = 'w-36 shrink-0';

/**
 * The settings of the game in play (spec §9.2), for the room's managers:
 * each control saves at once, shows its new value before the answer and
 * comes back to the room's value when the server refuses it.
 */
export function GameSettingsCard() {
    const ctx = useRoom();
    const { t } = useTrans();
    const baseId = useId();
    const [pending, setPending] = useState<Partial<SettingValues>>({});
    const [confirmingGuests, setConfirmingGuests] = useState(false);
    const saves = useRef(0);
    const { room, round } = ctx.snapshot;

    if (!room.canManage) {
        return null;
    }

    const { settings } = room;
    const stored: SettingValues = {
        wordTheme:
            settings.wordThemes.length === 1 ? settings.wordThemes[0] : null,
        categories: settings.wordThemes,
        turnSeconds: settings.turnSeconds,
        autoHints: settings.autoHints,
        takesTurns: settings.takesTurns,
        roundsPerGame: settings.roundsPerGame,
        gifVotes: settings.gifVotes,
        gifAuthorsHidden: settings.gifAuthorsHidden,
        guestsAllowed: room.access === 'link',
    };
    const values: SettingValues = { ...stored, ...pending };
    const rows = SettingsByGame[room.game].filter(
        (key) => key !== 'guestsAllowed' || !room.isIcebreaker,
    );
    const idOf = (key: GameSettingKey) => `${baseId}-${key}`;

    const save = async <K extends keyof SettingValues>(
        key: K,
        value: SettingValues[K],
    ): Promise<boolean> => {
        const save = ++saves.current;

        setPending((current) => ({ ...current, [key]: value }));

        const body =
            key === 'guestsAllowed'
                ? { access: value ? 'link' : 'team' }
                : settingsPatch(
                      key as Exclude<GameSettingKey, 'guestsAllowed'>,
                      value as SettingValues[Exclude<
                          GameSettingKey,
                          'guestsAllowed'
                      >],
                  );
        const result = await ctx.run(
            retroRequest(GameRoomsController.update(room.id), body),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }

        if (save === saves.current) {
            setPending({});
        }

        return result !== undefined;
    };

    const changeGuests = (allowed: boolean) => {
        if (allowed) {
            void save('guestsAllowed', true);

            return;
        }

        setConfirmingGuests(true);
    };

    const roundsOptions: number[] =
        values.roundsPerGame === null ||
        (RoundsOptions as readonly number[]).includes(values.roundsPerGame)
            ? [...RoundsOptions]
            : [...RoundsOptions, values.roundsPerGame].sort(
                  (first, second) => first - second,
              );

    const control = (key: GameSettingKey): ReactNode => {
        const id = idOf(key);

        switch (key) {
            case 'wordTheme':
                return (
                    <Select
                        value={
                            values.categories.length > 1 &&
                            values.wordTheme === null
                                ? MixedThemes
                                : (values.wordTheme ?? AllWords)
                        }
                        onValueChange={(value) =>
                            void save(
                                'wordTheme',
                                value === AllWords
                                    ? null
                                    : (value as WordTheme),
                            )
                        }
                    >
                        <SelectTrigger
                            id={id}
                            size="sm"
                            className={selectClass}
                        >
                            <SelectValue
                                placeholder={t(':count chosen', {
                                    count: values.categories.length,
                                })}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={AllWords}>
                                {t('All words')}
                            </SelectItem>
                            {WordThemes.map((theme) => (
                                <SelectItem key={theme} value={theme}>
                                    {wordThemeLabel(theme, t)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'categories':
                return (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id={id}
                                type="button"
                                variant="outline"
                                size="sm"
                                className={selectClass}
                            >
                                <span className="truncate">
                                    {values.categories.length === 0
                                        ? t('All')
                                        : t(':count chosen', {
                                              count: values.categories.length,
                                          })}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="grid gap-2">
                            {WordThemes.map((theme) => (
                                <Checkbox
                                    key={theme}
                                    label={wordThemeLabel(theme, t)}
                                    checked={values.categories.includes(theme)}
                                    onCheckedChange={(checked) =>
                                        void save(
                                            'categories',
                                            checked === true
                                                ? [...values.categories, theme]
                                                : values.categories.filter(
                                                      (chosen) =>
                                                          chosen !== theme,
                                                  ),
                                        )
                                    }
                                />
                            ))}
                        </PopoverContent>
                    </Popover>
                );
            case 'turnSeconds':
                return (
                    <Select
                        value={
                            values.turnSeconds === null
                                ? Off
                                : String(values.turnSeconds)
                        }
                        onValueChange={(value) =>
                            void save(
                                'turnSeconds',
                                value === Off ? null : Number(value),
                            )
                        }
                    >
                        <SelectTrigger
                            id={id}
                            size="sm"
                            className={selectClass}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Off}>{t('Off')}</SelectItem>
                            {TurnSecondsOptions.map((seconds) => (
                                <SelectItem
                                    key={seconds}
                                    value={String(seconds)}
                                >
                                    {t(':count s', { count: seconds })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'roundsPerGame':
                return (
                    <Select
                        value={
                            values.roundsPerGame === null
                                ? Endless
                                : String(values.roundsPerGame)
                        }
                        onValueChange={(value) =>
                            void save(
                                'roundsPerGame',
                                value === Endless ? null : Number(value),
                            )
                        }
                    >
                        <SelectTrigger
                            id={id}
                            size="sm"
                            className={selectClass}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Endless}>
                                {t('Endless')}
                            </SelectItem>
                            {roundsOptions.map((rounds) => (
                                <SelectItem key={rounds} value={String(rounds)}>
                                    {String(rounds)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'gifVotes':
                return (
                    <Select
                        value={String(values.gifVotes)}
                        onValueChange={(value) =>
                            void save('gifVotes', Number(value))
                        }
                    >
                        <SelectTrigger
                            id={id}
                            size="sm"
                            className={selectClass}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {GifVotesOptions.map((votes) => (
                                <SelectItem key={votes} value={String(votes)}>
                                    {t(':count each', { count: votes })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'autoHints':
            case 'takesTurns':
            case 'gifAuthorsHidden':
                return (
                    <Switch
                        id={id}
                        checked={values[key]}
                        onCheckedChange={(checked) => void save(key, checked)}
                    />
                );
            case 'guestsAllowed':
                return (
                    <Switch
                        id={id}
                        checked={values.guestsAllowed}
                        onCheckedChange={changeGuests}
                    />
                );
        }
    };

    return (
        <Card
            data-slot="game-settings-card"
            className="w-full shrink-0 gap-2 p-4"
        >
            <h3 className="text-sm font-title">
                {room.game === 'draw'
                    ? t('Round settings')
                    : t('Game settings')}
            </h3>
            {rows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('Answers are anonymous.')}
                </p>
            )}
            {rows.map((key) => (
                <SettingRow
                    key={key}
                    id={idOf(key)}
                    label={settingLabel(key, room.game, t)}
                >
                    {control(key)}
                </SettingRow>
            ))}
            {round !== null && (
                <p className="text-xs text-muted-foreground">
                    {t('Changes apply from the next round.')}
                </p>
            )}
            <ConfirmDialog
                open={confirmingGuests}
                onOpenChange={setConfirmingGuests}
                tone="destructive"
                title={t('Turn off guest access?')}
                description={t('Guests in this room lose access.')}
                confirmLabel={t('Turn off')}
                onConfirm={async () => {
                    if (!(await save('guestsAllowed', false))) {
                        throw new Error('The guest access was not changed.');
                    }
                }}
            />
        </Card>
    );
}
