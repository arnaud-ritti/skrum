import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    ChartColumn,
    Check,
    CircleAlert,
    Dices,
    Layers,
    PenTool,
    ShieldCheck,
    Spade,
    VenetianMask,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { LoadingButton } from '@/components/skrum/loading-button';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type GuestJoinSessionKind = 'retro' | 'poker' | 'whiteboard' | 'survey';

export type GuestJoinProps = {
    session: {
        code: string;
        kind: GuestJoinSessionKind;
        title: string;
        status: 'live' | 'scheduled';
        participants: number;
        facilitator: string;
    };
    /** Random nickname proposed when the field is left empty. */
    defaultName?: string;
    /** Pre-filled nickname; the field starts empty when absent. */
    initialName?: string;
    /** Backlog: the colour picker is only rendered when this list is given. */
    takenColors?: number[];
    /** Colour selected first; defaults to the first free one. */
    initialPresence?: number;
    error?: { field: 'name'; message: string } | null;
    processing?: boolean;
    onSubmit: (data: { name: string; presence?: number }) => void;
    onRandomName?: () => void;
    loginUrl: string;
    className?: string;
};

const MaxNameLength = 50;
const PresenceNumbers: AvatarPresence[] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

const kinds: Record<GuestJoinSessionKind, { icon: LucideIcon; tone: string }> =
    {
        retro: {
            icon: Layers,
            tone: 'bg-skrum-col-apricot text-skrum-col-apricot-text',
        },
        poker: {
            icon: Spade,
            tone: 'bg-skrum-col-iris text-skrum-col-iris-text',
        },
        whiteboard: {
            icon: PenTool,
            tone: 'bg-skrum-col-lagoon text-skrum-col-lagoon-text',
        },
        survey: {
            icon: ChartColumn,
            tone: 'bg-skrum-col-sky text-skrum-col-sky-text',
        },
    };

const swatchClasses: Record<AvatarPresence, string> = {
    1: 'bg-skrum-presence-1 text-skrum-presence-1-foreground',
    2: 'bg-skrum-presence-2 text-skrum-presence-2-foreground',
    3: 'bg-skrum-presence-3 text-skrum-presence-3-foreground',
    4: 'bg-skrum-presence-4 text-skrum-presence-4-foreground',
    5: 'bg-skrum-presence-5 text-skrum-presence-5-foreground',
    6: 'bg-skrum-presence-6 text-skrum-presence-6-foreground',
    7: 'bg-skrum-presence-7 text-skrum-presence-7-foreground',
    8: 'bg-skrum-presence-8 text-skrum-presence-8-foreground',
    9: 'bg-skrum-presence-9 text-skrum-presence-9-foreground',
    10: 'bg-skrum-presence-10 text-skrum-presence-10-foreground',
    11: 'bg-skrum-presence-11 text-skrum-presence-11-foreground',
    12: 'bg-skrum-presence-12 text-skrum-presence-12-foreground',
};

function nextFree(
    from: number,
    step: 1 | -1,
    taken: number[],
): AvatarPresence | null {
    for (let offset = 1; offset <= PresenceNumbers.length; offset++) {
        const index =
            (from - 1 + step * offset + PresenceNumbers.length * 2) %
            PresenceNumbers.length;
        const candidate = PresenceNumbers[index];

        if (!taken.includes(candidate)) {
            return candidate;
        }
    }

    return null;
}

export function GuestJoin({
    session,
    defaultName,
    initialName = '',
    takenColors,
    initialPresence,
    error = null,
    processing = false,
    onSubmit,
    onRandomName,
    loginUrl,
    className,
}: GuestJoinProps) {
    const { t } = useTrans();
    const ids = useId();
    const nameId = 'name';
    const helpId = `${ids}-help`;
    const errorId = `${ids}-error`;
    const colorLabelId = `${ids}-colors`;
    const swatchRefs = useRef<Partial<Record<number, HTMLButtonElement>>>({});

    const [name, setName] = useState(initialName);
    const [chosenColor, setChosenColor] = useState<AvatarPresence | null>(
        PresenceNumbers.find((n) => n === initialPresence) ?? null,
    );
    const [editedPast, setEditedPast] = useState<typeof error>(null);

    const showColors = takenColors !== undefined;
    const taken = takenColors ?? [];
    const firstFree = nextFree(12, 1, taken);
    const color =
        chosenColor !== null && !taken.includes(chosenColor)
            ? chosenColor
            : firstFree;
    const activeError = error !== null && editedPast !== error ? error : null;
    const trimmedName = name.trim();
    const hasName = trimmedName !== '';
    const previewName = hasName ? trimmedName : (defaultName ?? '');
    const previewPresence = showColors && color !== null ? color : undefined;
    const isBlocked = activeError !== null || processing;

    const { icon: KindIcon, tone } = kinds[session.kind];
    const kindLabels: Record<GuestJoinSessionKind, string> = {
        retro: t('Retrospective'),
        poker: t('Planning poker'),
        whiteboard: t('Whiteboard'),
        survey: t('Survey'),
    };
    const statusLabel = session.status === 'live' ? t('Live') : t('Scheduled');
    const participantsLabel =
        session.participants === 1
            ? t(':count participant', { count: 1 })
            : t(':count participants', { count: session.participants });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isBlocked) {
            return;
        }

        onSubmit({
            name: hasName ? trimmedName : (defaultName ?? ''),
            ...(showColors && color !== null ? { presence: color } : {}),
        });
    };

    const chooseColor = (value: AvatarPresence) => {
        setChosenColor(value);
        swatchRefs.current[value]?.focus();
    };

    const onSwatchKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (color === null) {
            return;
        }

        const step =
            event.key === 'ArrowRight' || event.key === 'ArrowDown'
                ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                  ? -1
                  : null;

        if (step === null) {
            return;
        }

        event.preventDefault();

        const target = nextFree(color, step, taken);

        if (target !== null) {
            chooseColor(target);
        }
    };

    return (
        <Card
            data-slot="guest-join"
            className={cn(
                'mx-auto w-full max-w-md gap-5 p-6 shadow-card',
                className,
            )}
        >
            <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                <SkrumLogo
                    variant="horizontal"
                    className="h-6 w-auto self-start"
                />

                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-title tracking-subheading">
                        {t('Join as a guest')}
                    </h2>
                    <p className="text-sm/snug text-muted-foreground">
                        {t('No account needed to take part.')}
                    </p>
                </div>

                <div
                    data-slot="guest-join-session"
                    data-kind={session.kind}
                    data-status={session.status}
                    className="flex items-start gap-3 rounded-lg bg-muted p-3"
                >
                    <span
                        aria-hidden
                        className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-md',
                            tone,
                        )}
                    >
                        <KindIcon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="line-clamp-2 font-semibold">
                            {session.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
                            <span className="sr-only">
                                {kindLabels[session.kind]}
                            </span>
                            <span
                                aria-hidden
                                className={cn(
                                    'size-1.5 rounded-full',
                                    session.status === 'live'
                                        ? 'bg-skrum-success'
                                        : 'bg-skrum-info',
                                )}
                            />
                            <span>{statusLabel}</span>
                            <span aria-hidden>·</span>
                            <span>{participantsLabel}</span>
                            <span aria-hidden>·</span>
                            <span>
                                {t(':name facilitates', {
                                    name: session.facilitator,
                                })}
                            </span>
                        </span>
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor={nameId}>{t('Your nickname')}</Label>
                    <Input
                        id={nameId}
                        name="name"
                        autoFocus
                        autoComplete="nickname"
                        maxLength={MaxNameLength}
                        value={name}
                        placeholder={defaultName}
                        aria-invalid={activeError !== null || undefined}
                        aria-describedby={
                            activeError !== null
                                ? `${helpId} ${errorId}`
                                : helpId
                        }
                        onChange={(event) => {
                            setName(event.target.value);
                            setEditedPast(error);
                        }}
                    />
                    <span id={helpId} className="text-xs text-muted-foreground">
                        {t('Visible to the other participants.')}
                    </span>
                    {activeError !== null && (
                        <span
                            id={errorId}
                            role="alert"
                            className="flex items-start gap-1.5 text-xs font-medium text-skrum-destructive-text"
                        >
                            <CircleAlert
                                className="mt-px size-3.5 shrink-0"
                                aria-hidden
                            />
                            {activeError.message}
                        </span>
                    )}
                </div>

                {showColors && (
                    <div className="flex flex-col gap-2">
                        <span id={colorLabelId} className="text-sm font-medium">
                            {t('Avatar colour')}
                        </span>
                        <div
                            role="radiogroup"
                            aria-labelledby={colorLabelId}
                            className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] justify-items-center @sm:grid-cols-[repeat(auto-fill,minmax(2rem,1fr))]"
                        >
                            {PresenceNumbers.map((number) => {
                                const isTaken = taken.includes(number);
                                const isSelected = color === number;

                                return (
                                    <button
                                        key={number}
                                        ref={(element) => {
                                            if (element) {
                                                swatchRefs.current[number] =
                                                    element;
                                            }
                                        }}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        aria-disabled={isTaken || undefined}
                                        aria-label={
                                            isTaken
                                                ? t('Colour :number (taken)', {
                                                      number,
                                                  })
                                                : t('Colour :number', {
                                                      number,
                                                  })
                                        }
                                        disabled={isTaken}
                                        tabIndex={isSelected ? 0 : -1}
                                        onClick={() => chooseColor(number)}
                                        onKeyDown={onSwatchKeyDown}
                                        className="group flex size-11 items-center justify-center rounded-full outline-none @sm:size-8"
                                    >
                                        <span
                                            className={cn(
                                                'flex size-6.5 items-center justify-center rounded-full transition-shadow duration-140 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card group-disabled:opacity-35 motion-reduce:transition-none',
                                                swatchClasses[number],
                                                isSelected &&
                                                    'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                                            )}
                                        >
                                            {isSelected && (
                                                <Check
                                                    className="size-3.5"
                                                    aria-hidden
                                                />
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div
                    data-slot="guest-join-preview"
                    className="flex items-center gap-3"
                >
                    {hasName ? (
                        <PersonAvatar
                            decorative
                            size="xl"
                            name={trimmedName}
                            presence={previewPresence}
                        />
                    ) : (
                        <PersonAvatar
                            decorative
                            size="xl"
                            kind="guest"
                            name={previewName}
                        />
                    )}
                    <span className="flex min-w-0 flex-col gap-1">
                        {hasName ? (
                            <>
                                <span className="truncate font-semibold">
                                    {trimmedName}
                                </span>
                                <Badge
                                    variant="secondary"
                                    className="w-fit rounded-full"
                                >
                                    <VenetianMask aria-hidden />
                                    {t('Guest')}
                                </Badge>
                            </>
                        ) : (
                            <>
                                <span className="truncate text-muted-foreground">
                                    {previewName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {t(
                                        'Suggested nickname if you leave it empty',
                                    )}
                                </span>
                            </>
                        )}
                    </span>
                </div>

                {!hasName && onRandomName && (
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={processing}
                        onClick={onRandomName}
                    >
                        <Dices aria-hidden />
                        {t('Another random nickname')}
                    </Button>
                )}

                <LoadingButton
                    type="submit"
                    size="lg"
                    className="w-full"
                    loading={processing}
                    loader="trema"
                    disabled={activeError !== null}
                >
                    {processing ? (
                        t('Connecting to the session…')
                    ) : (
                        <>
                            {t('Join')}
                            <ArrowRight aria-hidden />
                        </>
                    )}
                </LoadingButton>

                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck
                        className="mt-px size-4 shrink-0 text-skrum-success-text"
                        aria-hidden
                    />
                    {t(
                        'No personal data is asked. Your nickname is deleted when the session ends; your cards can stay anonymous.',
                    )}
                </p>
            </form>

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
                {t('Already have an account?')}{' '}
                <Link
                    href={loginUrl}
                    className="font-medium text-skrum-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    {t('Log in')}
                </Link>
            </p>
        </Card>
    );
}
