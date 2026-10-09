import {
    Brush,
    Check,
    Clock,
    CloudRain,
    CloudSun,
    Film,
    MessageCircleQuestion,
    Smile,
    Sun,
    UserRoundSearch,
    Users,
    VenetianMask,
    WholeWord,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind } from '@/lib/games/types';
import { cn } from '@/lib/utils';

export type IcebreakerGame = GameKind;

export type IcebreakerColor =
    | 'sun'
    | 'apricot'
    | 'coral'
    | 'plum'
    | 'iris'
    | 'sky'
    | 'lagoon'
    | 'moss';

export type IcebreakerGameCardProps = {
    game: IcebreakerGame;
    /** `GameOption.label`. */
    title: string;
    /** Front-end copy; the line is not rendered when absent. */
    pitch?: string;
    /** Defaults to the colour of the game. */
    color?: IcebreakerColor;
    /**
     * `GameOption.available`: the server decides (for example the GIF game
     * without a provider). `false` wins over the participant check.
     */
    available?: boolean;
    /** Shown when the game is unavailable; a generic reason otherwise. */
    unavailableReason?: string;
    /** `GameCatalogue` (spec §9.1): each line is hidden when absent. */
    durationMin?: number;
    /** "5–10 min" with `durationMin`. */
    durationMax?: number;
    /** "2 min / person": the duration is per speaker. */
    durationPerPerson?: boolean;
    /** "3 min · anonymous", beside the duration. */
    anonymous?: boolean;
    players?: { min: number; max: number };
    participants?: number;
    selected?: boolean;
    /** In a room the selected game is the one in play: the card says so, in place of the check. */
    inPlay?: boolean;
    /** For a narrow two-column picker: the game's icon alone stands for the illustration. */
    compact?: boolean;
    /** For who watches the choice of someone else: the card tells the choice and takes no click. */
    readOnly?: boolean;
    onSelect?: (game: IcebreakerGame) => void;
    className?: string;
};

const colorClasses: Record<
    IcebreakerColor,
    {
        art: string;
        border: string;
        text: string;
        letter: string;
        lie: string;
        onLie: string;
    }
> = {
    sun: {
        art: 'bg-skrum-col-sun',
        border: 'border-skrum-col-sun-border',
        text: 'text-skrum-col-sun-text',
        letter: 'border-b-skrum-col-sun-text',
        lie: 'bg-skrum-col-sun-text',
        onLie: 'text-skrum-col-sun',
    },
    apricot: {
        art: 'bg-skrum-col-apricot',
        border: 'border-skrum-col-apricot-border',
        text: 'text-skrum-col-apricot-text',
        letter: 'border-b-skrum-col-apricot-text',
        lie: 'bg-skrum-col-apricot-text',
        onLie: 'text-skrum-col-apricot',
    },
    coral: {
        art: 'bg-skrum-col-coral',
        border: 'border-skrum-col-coral-border',
        text: 'text-skrum-col-coral-text',
        letter: 'border-b-skrum-col-coral-text',
        lie: 'bg-skrum-col-coral-text',
        onLie: 'text-skrum-col-coral',
    },
    plum: {
        art: 'bg-skrum-col-plum',
        border: 'border-skrum-col-plum-border',
        text: 'text-skrum-col-plum-text',
        letter: 'border-b-skrum-col-plum-text',
        lie: 'bg-skrum-col-plum-text',
        onLie: 'text-skrum-col-plum',
    },
    iris: {
        art: 'bg-skrum-col-iris',
        border: 'border-skrum-col-iris-border',
        text: 'text-skrum-col-iris-text',
        letter: 'border-b-skrum-col-iris-text',
        lie: 'bg-skrum-col-iris-text',
        onLie: 'text-skrum-col-iris',
    },
    sky: {
        art: 'bg-skrum-col-sky',
        border: 'border-skrum-col-sky-border',
        text: 'text-skrum-col-sky-text',
        letter: 'border-b-skrum-col-sky-text',
        lie: 'bg-skrum-col-sky-text',
        onLie: 'text-skrum-col-sky',
    },
    lagoon: {
        art: 'bg-skrum-col-lagoon',
        border: 'border-skrum-col-lagoon-border',
        text: 'text-skrum-col-lagoon-text',
        letter: 'border-b-skrum-col-lagoon-text',
        lie: 'bg-skrum-col-lagoon-text',
        onLie: 'text-skrum-col-lagoon',
    },
    moss: {
        art: 'bg-skrum-col-moss',
        border: 'border-skrum-col-moss-border',
        text: 'text-skrum-col-moss-text',
        letter: 'border-b-skrum-col-moss-text',
        lie: 'bg-skrum-col-moss-text',
        onLie: 'text-skrum-col-moss',
    },
};

/** ScreenIcebreaker's colours; Draw & Guess and Sprint in one GIF take the two left. */
const defaultColors: Record<IcebreakerGame, IcebreakerColor> = {
    undercover: 'plum',
    hangman: 'coral',
    draw: 'iris',
    gif: 'apricot',
    decoded: 'sun',
    two_truths: 'plum',
    mood: 'sky',
    guess_who: 'moss',
    quick_question: 'lagoon',
};

const cornerIcons: Record<IcebreakerGame, LucideIcon> = {
    undercover: VenetianMask,
    hangman: WholeWord,
    draw: Brush,
    gif: Film,
    decoded: Smile,
    two_truths: VenetianMask,
    mood: CloudSun,
    guess_who: UserRoundSearch,
    quick_question: MessageCircleQuestion,
};

function HangmanArt({ color }: { color: IcebreakerColor }) {
    const letters = ['S', '', 'R', '', 'N', 'T'];

    return (
        <div className="flex gap-1.5">
            {letters.map((letter, index) => (
                <span
                    key={index}
                    className={cn(
                        'flex h-8 w-5 items-center justify-center border-b-2 font-display text-lg font-bold text-foreground',
                        colorClasses[color].letter,
                    )}
                >
                    {letter}
                </span>
            ))}
        </div>
    );
}

function DrawArt({ color }: { color: IcebreakerColor }) {
    return (
        <svg
            viewBox="0 0 120 60"
            className={cn('h-14 w-28', colorClasses[color].text)}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M10 48 C 22 10, 40 10, 48 34 S 72 58, 84 26 S 104 8, 112 20" />
            <path d="M60 50 l6 -6 l6 6 l-6 6 z" />
        </svg>
    );
}

function GifArt({ color }: { color: IcebreakerColor }) {
    const classes = colorClasses[color];

    return (
        <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((frame) => (
                <span
                    key={frame}
                    className={cn(
                        'h-10 w-8 rounded-md border bg-card',
                        classes.border,
                        frame === 1 && 'rotate-6',
                    )}
                >
                    <span
                        className={cn(
                            'mx-auto mt-3 block size-3 rounded-full opacity-80',
                            classes.lie,
                        )}
                    />
                </span>
            ))}
        </div>
    );
}

function DecodedArt() {
    return <span className="text-3xl tracking-widest">🍕🇮🇹✈️</span>;
}

function TwoTruthsArt({ color }: { color: IcebreakerColor }) {
    const { t } = useTrans();
    const classes = colorClasses[color];
    const truth = t('Two truths: truth initial');
    const cards = [truth, t('Two truths: lie initial'), truth];

    return (
        <div className="flex gap-1.5">
            {cards.map((letter, index) => (
                <span
                    key={index}
                    className={cn(
                        'grid h-9 w-7.5 place-items-center rounded-md border text-sm font-bold',
                        index === 1
                            ? cn('rotate-6', classes.lie, classes.onLie)
                            : cn('bg-card', classes.border, classes.text),
                    )}
                >
                    {letter}
                </span>
            ))}
        </div>
    );
}

function MoodArt({ color }: { color: IcebreakerColor }) {
    return (
        <div className={cn('flex items-end gap-2', colorClasses[color].text)}>
            <Sun className="size-7" />
            <CloudSun className="size-9" />
            <CloudRain className="size-7" />
        </div>
    );
}

function GuessWhoArt({ color }: { color: IcebreakerColor }) {
    const classes = colorClasses[color];

    return (
        <div className="relative flex items-center">
            {[0, 1].map((avatar) => (
                <span
                    key={avatar}
                    className={cn(
                        'size-10 rounded-full border-2 bg-card',
                        classes.border,
                        avatar === 1 && '-ml-3',
                    )}
                />
            ))}
            <span
                className={cn(
                    'absolute inset-0 grid place-items-center font-display text-2xl font-bold',
                    classes.text,
                )}
            >
                ?
            </span>
        </div>
    );
}

function QuickQuestionArt({ color }: { color: IcebreakerColor }) {
    const classes = colorClasses[color];

    return (
        <span
            className={cn(
                'flex h-10 items-center gap-1.5 rounded-xl rounded-bl-none border bg-card px-4',
                classes.border,
            )}
        >
            {[0, 1, 2].map((dot) => (
                <span
                    key={dot}
                    className={cn('size-2 rounded-full', classes.lie)}
                />
            ))}
        </span>
    );
}

function Art({
    game,
    color,
}: {
    game: IcebreakerGame;
    color: IcebreakerColor;
}) {
    if (game === 'undercover') {
        return (
            <VenetianMask className={cn('size-12', colorClasses[color].text)} />
        );
    }

    if (game === 'hangman') {
        return <HangmanArt color={color} />;
    }

    if (game === 'draw') {
        return <DrawArt color={color} />;
    }

    if (game === 'gif') {
        return <GifArt color={color} />;
    }

    if (game === 'two_truths') {
        return <TwoTruthsArt color={color} />;
    }

    if (game === 'mood') {
        return <MoodArt color={color} />;
    }

    if (game === 'guess_who') {
        return <GuessWhoArt color={color} />;
    }

    if (game === 'quick_question') {
        return <QuickQuestionArt color={color} />;
    }

    return <DecodedArt />;
}

export function unavailabilityReason(
    players: { min: number; max: number } | undefined,
    participants: number | undefined,
    t: (key: string, replacements?: Record<string, string | number>) => string,
): string | null {
    if (players === undefined || participants === undefined) {
        return null;
    }

    if (participants < players.min) {
        return t('min. :count players', { count: players.min });
    }

    if (participants > players.max) {
        return t('max. :count players', { count: players.max });
    }

    return null;
}

function durationLine(
    t: (key: string, replacements?: Record<string, string | number>) => string,
    durationMin: number,
    durationMax: number | undefined,
    durationPerPerson: boolean,
    anonymous: boolean,
): string {
    const duration =
        durationMax !== undefined
            ? t(':min–:max min', { min: durationMin, max: durationMax })
            : durationPerPerson
              ? t(':count min / person', { count: durationMin })
              : t(':count min', { count: durationMin });

    if (!anonymous) {
        return duration;
    }

    return `${duration} · ${t('anonymous')}`;
}

export function IcebreakerGameCard({
    game,
    title,
    pitch,
    color = defaultColors[game],
    available,
    unavailableReason,
    durationMin,
    durationMax,
    durationPerPerson = false,
    anonymous = false,
    players,
    participants,
    selected = false,
    inPlay = false,
    compact = false,
    readOnly = false,
    onSelect,
    className,
}: IcebreakerGameCardProps) {
    const { t } = useTrans();
    const id = useId();
    const reason =
        available === false
            ? (unavailableReason ?? t('Not available'))
            : unavailabilityReason(players, participants, t);
    const unavailable = reason !== null;
    const isInPlay = selected && inPlay;
    const hasMeta = durationMin !== undefined || players !== undefined;
    const CornerIcon = cornerIcons[game];
    const classes = colorClasses[color];
    const titleId = `${id}-title`;
    const describedBy = [
        pitch !== undefined ? `${id}-pitch` : null,
        hasMeta ? `${id}-meta` : null,
        unavailable ? `${id}-reason` : null,
        isInPlay ? `${id}-in-play` : null,
    ]
        .filter(Boolean)
        .join(' ');
    const describedByAttribute = describedBy === '' ? undefined : describedBy;

    return (
        <button
            type="button"
            role="radio"
            data-slot="icebreaker-game-card"
            data-game={game}
            data-selected={selected}
            data-unavailable={unavailable}
            data-compact={compact || undefined}
            data-readonly={readOnly || undefined}
            aria-checked={selected}
            aria-disabled={unavailable || readOnly || undefined}
            aria-labelledby={titleId}
            aria-describedby={describedByAttribute}
            onClick={() => {
                if (unavailable || readOnly) {
                    return;
                }

                onSelect?.(game);
            }}
            className={cn(
                '@container/card relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-0 text-left text-card-foreground shadow-card',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'motion-safe:transition-[box-shadow,transform] motion-safe:duration-140 motion-safe:ease-standard',
                unavailable && 'cursor-not-allowed opacity-55',
                !unavailable && readOnly && 'cursor-default',
                !unavailable &&
                    !readOnly &&
                    'cursor-pointer hover:-translate-y-0.5 hover:shadow-raised',
                selected && 'border-primary shadow-raised ring-2 ring-primary',
                className,
            )}
        >
            {selected && !inPlay && (
                <span
                    data-slot="icebreaker-game-check"
                    aria-hidden
                    className="absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"
                >
                    <Check className="size-3.5 stroke-3" />
                </span>
            )}
            <div
                aria-hidden
                className={cn(
                    'relative flex items-center justify-center overflow-hidden',
                    compact ? 'h-16' : 'h-20 sm:h-24',
                    classes.art,
                )}
            >
                {compact ? (
                    <CornerIcon className={cn('size-7', classes.text)} />
                ) : (
                    <>
                        <span data-slot="icebreaker-art" className="contents">
                            <Art game={game} color={color} />
                        </span>
                        <CornerIcon
                            className={cn(
                                'absolute bottom-2 left-3 size-5 opacity-80',
                                classes.text,
                            )}
                        />
                    </>
                )}
            </div>
            <div className="flex min-w-0 flex-col gap-1 p-3">
                {unavailable && (
                    <span
                        id={`${id}-reason`}
                        className="truncate text-xs font-semibold text-muted-foreground"
                    >
                        {reason}
                    </span>
                )}
                <span
                    id={titleId}
                    className="line-clamp-2 text-sm leading-snug font-semibold break-words"
                >
                    {title}
                </span>
                {pitch !== undefined && (
                    <span
                        id={`${id}-pitch`}
                        className="line-clamp-2 text-xs leading-snug break-words text-muted-foreground"
                    >
                        {pitch}
                    </span>
                )}
                {hasMeta && (
                    <span
                        id={`${id}-meta`}
                        className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-muted-foreground"
                    >
                        {durationMin !== undefined && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                <Clock className="size-3.5" aria-hidden />
                                {durationLine(
                                    t,
                                    durationMin,
                                    durationMax,
                                    durationPerPerson,
                                    anonymous,
                                )}
                            </span>
                        )}
                        {players !== undefined && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                <Users className="size-3.5" aria-hidden />
                                <span aria-hidden>
                                    {players.min}-{players.max}
                                </span>
                                <span className="sr-only">
                                    {t(':min to :max players', {
                                        min: players.min,
                                        max: players.max,
                                    })}
                                </span>
                            </span>
                        )}
                    </span>
                )}
                {isInPlay && (
                    <span
                        id={`${id}-in-play`}
                        data-slot="icebreaker-game-in-play"
                        className="mt-1 inline-flex h-5 max-w-full items-center gap-1 self-start rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground"
                    >
                        <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full bg-primary-foreground"
                        />
                        <span className="truncate">{t('In play')}</span>
                    </span>
                )}
            </div>
        </button>
    );
}

export type IcebreakerGameGridProps = {
    children: ReactNode;
    className?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
};

export function IcebreakerGameGrid({
    children,
    className,
    ...aria
}: IcebreakerGameGridProps) {
    const { t } = useTrans();
    const ref = useRef<HTMLDivElement>(null);

    const radios = (): HTMLElement[] =>
        Array.from(
            ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
        );

    useEffect(() => {
        const items = radios();
        const active =
            items.find(
                (item) => item.getAttribute('aria-checked') === 'true',
            ) ?? items[0];

        items.forEach((item) => {
            item.tabIndex = item === active ? 0 : -1;
        });
    });

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
        const edge = event.key === 'Home' || event.key === 'End';

        if (!forward && !backward && !edge) {
            return;
        }

        const items = radios();
        const current = items.indexOf(document.activeElement as HTMLElement);

        if (current === -1) {
            return;
        }

        event.preventDefault();

        const next = edge
            ? items[event.key === 'Home' ? 0 : items.length - 1]
            : items[
                  (current + (forward ? 1 : -1) + items.length) % items.length
              ];

        items.forEach((item) => {
            item.tabIndex = item === next ? 0 : -1;
        });
        next.focus();
    };

    return (
        <div
            ref={ref}
            role="radiogroup"
            aria-label={t('Choose an icebreaker')}
            {...aria}
            onKeyDown={onKeyDown}
            className={cn(
                'grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]',
                className,
            )}
        >
            {children}
        </div>
    );
}
