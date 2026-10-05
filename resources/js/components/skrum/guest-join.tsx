import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    ChartColumn,
    CircleAlert,
    Dices,
    Gamepad2,
    Layers,
    PenTool,
    ShieldCheck,
    Spade,
    VenetianMask,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { LoadingButton } from '@/components/skrum/loading-button';
import {
    nextFreePresence,
    PresenceNumbers,
    PresenceSwatches,
} from '@/components/skrum/presence-swatches';
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

export type GuestJoinSessionKind =
    | 'retro'
    | 'poker'
    | 'whiteboard'
    | 'game'
    | 'survey';

export type GuestJoinProps = {
    session: {
        kind: GuestJoinSessionKind;
        title: string;
        /** Name of the game played in a game room (`gameLabel` of games/join). */
        gameLabel?: string;
        /** Backlog (join by short code): the join pages do not receive these. */
        code?: string;
        status?: 'live' | 'scheduled';
        participants?: number;
        facilitator?: string;
        /** Retro only: the cards of this retro do not show their author. */
        anonymousCards?: boolean;
    };
    /** Random nickname proposed when the field is left empty. */
    defaultName?: string;
    /**
     * Pre-filled nickname; the field starts empty when absent. A new value
     * (another random nickname was drawn) replaces what the field holds.
     */
    initialName?: string;
    /** The colour picker is only rendered when this list is given. */
    takenColors?: number[];
    /** Colour selected first; defaults to the first free one. */
    initialPresence?: number;
    /** `lg`: the phone's 6 × 2 grid of 48 px targets (MobileAccess). */
    swatchSize?: 'md' | 'lg';
    error?: { field: 'name'; message: string } | null;
    processing?: boolean;
    /**
     * `formData` holds every named control of the form, including the ones
     * passed as `children` (for example the poker "Join as spectator" switch).
     */
    onSubmit: (
        data: { name: string; presence?: number },
        formData: FormData,
    ) => void;
    /** Extra controls rendered between the nickname and the join button. */
    children?: ReactNode;
    /** Draws another random nickname; the button is absent without it. */
    onRandomName?: () => void;
    /** Another nickname is being drawn: the draw button ignores clicks. */
    drawingName?: boolean;
    /** Id of the nickname field; `name` by default, as the join pages use. */
    nameInputId?: string;
    /** Pins the join button to the bottom of the viewport (phone). */
    stickyAction?: boolean;
    loginUrl: string;
    /**
     * The Skrüm logo at the top of the card. Off inside a page frame that
     * already shows the instance's own logo.
     */
    logo?: boolean;
    className?: string;
};

const MaxNameLength = 50;
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
        game: {
            icon: Gamepad2,
            tone: 'bg-skrum-col-sky text-skrum-col-sky-text',
        },
        survey: {
            icon: ChartColumn,
            tone: 'bg-skrum-col-iris text-skrum-col-iris-text',
        },
    };

export function GuestJoin({
    session,
    defaultName,
    initialName = '',
    takenColors,
    initialPresence,
    swatchSize = 'md',
    error = null,
    processing = false,
    onSubmit,
    children,
    onRandomName,
    drawingName = false,
    nameInputId = 'name',
    stickyAction = false,
    loginUrl,
    logo = true,
    className,
}: GuestJoinProps) {
    const { t } = useTrans();
    const ids = useId();
    const nameId = nameInputId;
    const helpId = `${ids}-help`;
    const errorId = `${ids}-error`;

    const [name, setName] = useState(initialName);
    const [syncedInitialName, setSyncedInitialName] = useState(initialName);
    const [chosenColor, setChosenColor] = useState<AvatarPresence | null>(
        PresenceNumbers.find((n) => n === initialPresence) ?? null,
    );
    const [editedPast, setEditedPast] = useState<typeof error>(null);
    const [announcedName, setAnnouncedName] = useState('');
    const [wasDrawing, setWasDrawing] = useState(drawingName);
    const drawEnded = wasDrawing && !drawingName;

    if (wasDrawing !== drawingName) {
        setWasDrawing(drawingName);
    }

    if (initialName !== syncedInitialName || drawEnded) {
        setSyncedInitialName(initialName);
        setName(initialName);
        setEditedPast(error);
        setAnnouncedName(initialName);
    }

    const showColors = takenColors !== undefined;
    const taken = takenColors ?? [];
    const firstFree = nextFreePresence(12, 1, taken);
    const color =
        chosenColor !== null && !taken.includes(chosenColor)
            ? chosenColor
            : firstFree;
    const activeError = error !== null && editedPast !== error ? error : null;
    const trimmedName = name.trim();
    const hasName = trimmedName !== '';
    const previewName = hasName ? trimmedName : (defaultName ?? '');
    const hasPreview = previewName !== '';
    const previewPresence = showColors && color !== null ? color : undefined;
    const isBlocked = activeError !== null || processing;

    const { icon: KindIcon, tone } = kinds[session.kind];
    const kindLabels: Record<GuestJoinSessionKind, string> = {
        retro: t('Retrospective'),
        poker: t('Planning poker'),
        whiteboard: t('Whiteboard'),
        game: t('Game'),
        survey: t('Survey'),
    };
    const details: { key: string; node: ReactNode }[] = [];

    if (session.gameLabel !== undefined) {
        details.push({ key: 'game', node: session.gameLabel });
    }

    if (session.status !== undefined) {
        details.push({
            key: 'status',
            node: (
                <span className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className={cn(
                            'size-1.5 rounded-full',
                            session.status === 'live'
                                ? 'bg-skrum-success'
                                : 'bg-skrum-info',
                        )}
                    />
                    {session.status === 'live' ? t('Live') : t('Scheduled')}
                </span>
            ),
        });
    }

    if (session.participants !== undefined) {
        details.push({
            key: 'participants',
            node:
                session.participants === 1
                    ? t(':count participant', { count: 1 })
                    : t(':count participants', {
                          count: session.participants,
                      }),
        });
    }

    if (session.facilitator !== undefined) {
        details.push({
            key: 'facilitator',
            node: t(':name facilitates', { name: session.facilitator }),
        });
    }

    if (session.code !== undefined) {
        details.push({
            key: 'code',
            node: t('Code :code', { code: session.code }),
        });
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isBlocked) {
            return;
        }

        const joinName = Array.from(hasName ? trimmedName : (defaultName ?? ''))
            .slice(0, MaxNameLength)
            .join('')
            .trim();
        const formData = new FormData(event.currentTarget);

        formData.set('name', joinName);

        onSubmit(
            {
                name: joinName,
                ...(showColors && color !== null ? { presence: color } : {}),
            },
            formData,
        );
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
                {logo && (
                    <SkrumLogo
                        variant="horizontal"
                        className="h-6 w-auto self-start"
                    />
                )}

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
                        <span className="line-clamp-2 font-semibold break-words">
                            {session.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
                            <span
                                className={cn(details.length > 0 && 'sr-only')}
                            >
                                {kindLabels[session.kind]}
                            </span>
                            {details.map((detail, index) => (
                                <Fragment key={detail.key}>
                                    {index > 0 && <span aria-hidden>·</span>}
                                    <span
                                        data-slot={`guest-join-${detail.key}`}
                                        className="min-w-0 break-words"
                                    >
                                        {detail.node}
                                    </span>
                                </Fragment>
                            ))}
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
                        <span aria-hidden className="text-sm font-medium">
                            {t('Avatar colour')}
                        </span>
                        <PresenceSwatches
                            value={color}
                            onChange={setChosenColor}
                            taken={taken}
                            label={t('Avatar colour')}
                            size={swatchSize}
                        />
                    </div>
                )}

                {hasPreview && (
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
                                    {defaultName !== undefined && (
                                        <span className="text-xs text-muted-foreground">
                                            {t(
                                                'Suggested nickname if you leave it empty',
                                            )}
                                        </span>
                                    )}
                                </>
                            )}
                        </span>
                    </div>
                )}

                {onRandomName && (
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full aria-disabled:opacity-50"
                            disabled={processing}
                            aria-disabled={drawingName || undefined}
                            onClick={() => {
                                if (!drawingName) {
                                    onRandomName();
                                }
                            }}
                        >
                            <Dices aria-hidden />
                            <span className="truncate">
                                {t('Another random nickname')}
                            </span>
                        </Button>
                        <span
                            role="status"
                            data-slot="guest-join-drawn-name"
                            className="sr-only"
                        >
                            {announcedName}
                        </span>
                    </>
                )}

                {children}

                <div
                    data-slot="guest-join-action"
                    className={cn(
                        stickyAction &&
                            'sticky bottom-0 -mx-6 border-t bg-card px-6 py-3',
                    )}
                >
                    <LoadingButton
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={processing}
                        loader="trema"
                        disabled={activeError !== null}
                    >
                        <span className="truncate">
                            {processing
                                ? t('Connecting to the session…')
                                : t('Join the session')}
                        </span>
                        {!processing && <ArrowRight aria-hidden />}
                    </LoadingButton>
                </div>

                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck
                        className="mt-px size-4 shrink-0 text-skrum-success-text"
                        aria-hidden
                    />
                    <span data-slot="guest-join-privacy">
                        {t(
                            'No account and no e-mail needed. The others see your nickname.',
                        )}
                        {session.kind === 'retro' && session.anonymousCards && (
                            <> {t('Cards are anonymous in this retro.')}</>
                        )}
                    </span>
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
