import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    ChevronDown,
    ClipboardList,
    HeartPulse,
    Lock,
    Minus,
    Plus,
    Settings2,
    Vote,
    X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, KeyboardEvent, ReactNode, RefObject } from 'react';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { RetroPhase } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

type TitleComponent =
    | 'h2'
    | ComponentType<{ className?: string; children?: ReactNode }>;

export type { RetroPhase };

/** A back-end phase id. Phases added later are accepted as plain strings. */
export type SessionPhase = RetroPhase | (string & {});

export type SettingValue = boolean | number | string | null;

/** What "Add survey" adds to the retro. */
export type SurveyKind = 'health_check' | 'quick_poll';

export type SessionSurveys = {
    /** How many statements the team's health check asks. */
    healthCheckStatements: number;
    /** A health check is attached: it cannot be added twice. */
    healthCheckAttached: boolean;
    /** False where the retro takes no quick poll (its phase, its limit). */
    quickPollAvailable?: boolean;
};

export type SessionSettingsValues = Record<string, SettingValue>;

type SettingBase = {
    /** Key of the value, the draft and the patch: the back-end field name. */
    key: string;
    label: string;
    help?: string;
    /** DOM id of the control, for labels and browser tests. */
    id?: string;
    /** When set, the control is disabled and this sentence says why. */
    disabledReason?: string;
    /** The row is rendered only while another setting has this value. */
    visibleWhen?: { key: string; equals: SettingValue };
};

export type SwitchSetting = SettingBase & {
    type: 'switch';
    onLabel?: string;
    offLabel?: string;
};

export type StepperSetting = SettingBase & {
    type: 'stepper';
    min: number;
    max: number;
    /**
     * Adds an "automatic" switch: the value is `null` while it is on, and
     * reads `valueLabel` ("Automatic" by default).
     */
    auto?: {
        label: string;
        help?: string;
        id?: string;
        fallback: number;
        valueLabel?: string;
    };
};

export type SelectSetting = SettingBase & {
    type: 'select';
    options: { value: string; label: string; disabled?: boolean }[];
};

export type TextSetting = SettingBase & {
    type: 'text';
    maxLength?: number;
    required?: boolean;
};

export type SessionSetting =
    | SwitchSetting
    | StepperSetting
    | SelectSetting
    | TextSetting;

export type SessionSettingGroup = {
    id: string;
    label: string;
    settings: SessionSetting[];
};

export type SessionSettingsPopoverProps<
    V extends SessionSettingsValues = SessionSettingsValues,
> = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Heading of the panel. Defaults to "Session settings". */
    title?: string;
    sessionTitle: string;
    phase?: SessionPhase;
    /** Labels for phases this component does not know yet. */
    phaseLabels?: Record<string, string>;
    groups: SessionSettingGroup[];
    value: V;
    draft?: Partial<V>;
    onDraftChange: (draft: Partial<V>) => void;
    deferred?: { key: string; fromPhase: SessionPhase }[];
    /** Server validation messages by setting key. */
    errors?: Record<string, string | undefined>;
    readOnly?: boolean;
    facilitatorName?: string;
    /** Adds a survey of the chosen kind. The entry is hidden without it. */
    onAddSurvey?: (kind: SurveyKind) => void;
    /** The state of the "Add survey" menu; without it, the health check is left out. */
    surveys?: SessionSurveys;
    /** Rendered after the groups: deck fields, guest link and the like. */
    children?: ReactNode;
    onApply: (patch: Partial<V>) => Promise<void>;
    onReset: () => void;
    variant?: 'popover' | 'sheet' | 'drawer';
    trigger?: ReactNode;
    /** Without a trigger: the element the popover is anchored to. */
    anchorRef?: RefObject<HTMLElement | null>;
};

type LooseProps = SessionSettingsPopoverProps<SessionSettingsValues>;

export const MinRetroVotes = 1;
export const MaxRetroVotes = 20;
export const MaxSessionTitleLength = 120;

const votePhases = ['icebreaker', 'writing', 'grouping'];

export type RetroSettingsValues = {
    title: string;
    is_anonymous: boolean;
    votes_per_participant: number | null;
    max_votes_per_card: number | null;
    icebreaker_enabled: boolean;
    icebreaker_game: string;
    reactions_enabled: boolean;
    cursors_enabled: boolean;
    gifs_enabled: boolean;
    hide_vote_counts: boolean;
    is_locked: boolean;
    presentation_mode: boolean;
    ai_summary_enabled: boolean;
};

export type RetroSettingsContext = {
    phase: SessionPhase;
    /** Applied values: `isAnonymous` and the current icebreaker game. */
    isAnonymous: boolean;
    icebreakerGame: string;
    /** The effective vote limit, shown when "automatic" is turned off. */
    votesPerParticipant: number;
    hasCards: boolean;
    /** Health check answers or survey activity exist. */
    hasAnswers?: boolean;
    icebreakerGames?: { value: string; label: string; available: boolean }[];
    /** The GIF switch exists only when a provider is configured. */
    gifProvider?: string | null;
    /** The AI summary switch exists only when a provider is configured. */
    llmProvider?: string | null;
};

/**
 * The retro settings RetroSettingsController accepts, with its rules: which
 * exist, their ranges and when each one is refused. Keys are the request
 * fields, so the patch given to `onApply` can be sent as it is.
 */
export function useRetroSettingGroups(
    context: RetroSettingsContext,
): SessionSettingGroup[] {
    const { t } = useTrans();
    const { phase } = context;
    const completed =
        phase === 'completed'
            ? t('This retrospective is completed.')
            : undefined;
    const phaseOn = t('Move to another phase before turning this phase off.');

    const anonymityLocked = (): string | undefined => {
        if (!context.isAnonymous) {
            return undefined;
        }

        if (context.hasCards) {
            return t(
                'Anonymity can only be turned off before any card is written.',
            );
        }

        if (context.hasAnswers) {
            return t('Anonymity can only be turned off before anyone answers.');
        }

        return undefined;
    };

    const voteLimitLocked = votePhases.includes(phase)
        ? undefined
        : t('The vote limit can only change before voting starts.');

    const games = (context.icebreakerGames ?? []).filter(
        (game) => game.available || game.value === context.icebreakerGame,
    );

    const groups: SessionSettingGroup[] = [
        {
            id: 'general',
            label: t('General'),
            settings: [
                {
                    type: 'text',
                    key: 'title',
                    id: 'retro-title',
                    label: t('Title'),
                    maxLength: MaxSessionTitleLength,
                    required: true,
                },
            ],
        },
        {
            id: 'cards',
            label: t('Cards'),
            settings: [
                {
                    type: 'switch',
                    key: 'is_anonymous',
                    id: 'retro-anonymous',
                    label: t('Anonymous cards'),
                    help: t('Authors hidden from everyone'),
                    disabledReason: anonymityLocked(),
                },
                {
                    type: 'switch',
                    key: 'is_locked',
                    id: 'retro-locked',
                    label: t('Lock board'),
                    help: t('No new cards or edits'),
                    onLabel: t('Locked'),
                    offLabel: t('Unlocked'),
                    disabledReason: completed,
                },
            ],
        },
        {
            id: 'voting',
            label: t('Voting'),
            settings: [
                {
                    type: 'stepper',
                    key: 'votes_per_participant',
                    id: 'retro-votes',
                    label: t('Votes per participant'),
                    min: MinRetroVotes,
                    max: MaxRetroVotes,
                    auto: {
                        id: 'retro-votes-auto',
                        label: t('Automatic vote limit'),
                        help: t(
                            'Automatic: number of cards plus 3, at most 10.',
                        ),
                        fallback: context.votesPerParticipant,
                    },
                    disabledReason: voteLimitLocked,
                },
                {
                    type: 'stepper',
                    key: 'max_votes_per_card',
                    id: 'retro-max-votes-per-card',
                    label: t('Max per card'),
                    help: t('Votes one person can stack'),
                    min: MinRetroVotes,
                    max: context.votesPerParticipant,
                    auto: {
                        id: 'retro-max-votes-per-card-auto',
                        label: t('No limit per card'),
                        valueLabel: t('No limit'),
                        fallback: Math.min(2, context.votesPerParticipant),
                    },
                    disabledReason: voteLimitLocked,
                },
                {
                    type: 'switch',
                    key: 'hide_vote_counts',
                    id: 'retro-hide-vote-counts',
                    label: t('Hide vote counts'),
                    help: t('Counts stay secret while voting'),
                    disabledReason: completed,
                },
            ],
        },
        {
            id: 'phases',
            label: t('Phases'),
            settings: [
                {
                    type: 'switch',
                    key: 'icebreaker_enabled',
                    id: 'retro-icebreaker',
                    label: t('Icebreaker'),
                    disabledReason:
                        completed ??
                        (phase === 'icebreaker' ? phaseOn : undefined),
                },
                {
                    type: 'select',
                    key: 'icebreaker_game',
                    id: 'retro-icebreaker-game',
                    label: t('Icebreaker game'),
                    visibleWhen: { key: 'icebreaker_enabled', equals: true },
                    options: games.map((game) => ({
                        value: game.value,
                        label: game.label,
                        disabled: !game.available,
                    })),
                    disabledReason: completed,
                },
            ],
        },
        {
            id: 'engagement',
            label: t('Presence'),
            settings: [
                {
                    type: 'switch',
                    key: 'reactions_enabled',
                    id: 'retro-reactions',
                    label: t('Show reactions'),
                    disabledReason: completed,
                },
                {
                    type: 'switch',
                    key: 'cursors_enabled',
                    id: 'retro-cursors',
                    label: t('Show live cursors'),
                    disabledReason: completed,
                },
                ...(context.gifProvider
                    ? [
                          {
                              type: 'switch',
                              key: 'gifs_enabled',
                              id: 'retro-gifs',
                              label: t('Allow GIFs'),
                              disabledReason: completed,
                          } satisfies SwitchSetting,
                      ]
                    : []),
                {
                    type: 'switch',
                    key: 'presentation_mode',
                    id: 'retro-presentation',
                    label: t('Presentation mode'),
                    disabledReason: completed,
                },
            ],
        },
    ];

    if (context.llmProvider) {
        groups.push({
            id: 'ai',
            label: t('AI'),
            settings: [
                {
                    type: 'switch',
                    key: 'ai_summary_enabled',
                    id: 'retro-ai-summary',
                    label: t('Automatic AI summary'),
                    help: t(
                        'When the retro is completed, its board content is sent automatically to :provider to write a summary. Participants can also ask it to suggest group names. Turn this off to keep it on this server.',
                        { provider: context.llmProvider },
                    ),
                    disabledReason: completed,
                },
            ],
        });
    }

    return groups;
}

function isMacLike(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad/.test(navigator.platform)
    );
}

function Stepper({
    id,
    labelId,
    describedBy,
    value,
    min,
    max,
    changed,
    disabled,
    onChange,
}: {
    id?: string;
    labelId: string;
    describedBy?: string;
    value: number;
    min: number;
    max: number;
    changed: boolean;
    disabled: boolean;
    onChange: (value: number) => void;
}) {
    const { t } = useTrans();
    const [text, setText] = useState(String(value));
    const [lastValue, setLastValue] = useState(value);

    if (lastValue !== value) {
        setLastValue(value);
        setText(String(value));
    }

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowUp') {
            event.preventDefault();

            if (value < max) {
                onChange(value + 1);
            }
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();

            if (value > min) {
                onChange(value - 1);
            }
        }
    };

    const onType = (next: string) => {
        setText(next);

        const parsed = Number(next);

        if (
            next.trim() !== '' &&
            Number.isInteger(parsed) &&
            parsed >= min &&
            parsed <= max &&
            parsed !== value
        ) {
            onChange(parsed);
        }
    };

    return (
        <div
            role="group"
            aria-labelledby={labelId}
            className={cn(
                'inline-flex h-8 items-center rounded-md border border-input bg-card',
                changed && 'border-primary',
            )}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-none"
                aria-label={t('Decrease')}
                disabled={disabled || value <= min}
                onClick={() => onChange(value - 1)}
            >
                <Minus aria-hidden="true" />
            </Button>
            <input
                id={id}
                type="text"
                inputMode="numeric"
                role="spinbutton"
                aria-labelledby={labelId}
                aria-describedby={describedBy}
                aria-valuenow={value}
                aria-valuemin={min}
                aria-valuemax={max}
                value={text}
                disabled={disabled}
                onChange={(event) => onType(event.target.value)}
                onBlur={() => setText(String(value))}
                onKeyDown={onKeyDown}
                className="h-full w-10 min-w-0 border-x bg-transparent text-center text-sm font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55"
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-none"
                aria-label={t('Increase')}
                disabled={disabled || value >= max}
                onClick={() => onChange(value + 1)}
            >
                <Plus aria-hidden="true" />
            </Button>
        </div>
    );
}

function SettingRow({
    labelId,
    label,
    help,
    reason,
    reasonId,
    error,
    changed,
    stacked = false,
    nested = false,
    children,
}: {
    labelId: string;
    label: string;
    help?: string;
    reason?: string;
    reasonId?: string;
    error?: string;
    changed: boolean;
    stacked?: boolean;
    nested?: boolean;
    children: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <div
            data-slot="setting-row"
            className={cn(
                'flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1',
                nested && 'pl-4',
            )}
        >
            <div
                className={cn(
                    'min-w-0 flex-1',
                    stacked ? 'basis-full' : 'basis-36',
                )}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    {changed && (
                        <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-primary"
                        />
                    )}
                    <span
                        id={labelId}
                        className="min-w-0 text-body-sm font-semibold wrap-anywhere"
                    >
                        {label}
                    </span>
                    {changed && (
                        <span className="shrink-0 text-overline text-skrum-primary-text uppercase">
                            {t('Modified')}
                        </span>
                    )}
                </div>
                {help !== undefined && (
                    <p className="text-xs text-muted-foreground">{help}</p>
                )}
                {reason !== undefined && (
                    <p
                        id={reasonId}
                        data-slot="setting-reason"
                        className="flex items-start gap-1 text-xs text-muted-foreground"
                    >
                        <Lock
                            aria-hidden="true"
                            className="mt-0.5 size-3 shrink-0"
                        />
                        <span className="min-w-0">{reason}</span>
                    </p>
                )}
                {error !== undefined && (
                    <p
                        role="alert"
                        className="text-xs text-skrum-destructive-text"
                    >
                        {error}
                    </p>
                )}
            </div>
            <div
                className={cn(
                    'max-w-full min-w-0',
                    stacked ? 'basis-full' : 'shrink-0',
                )}
            >
                {children}
            </div>
        </div>
    );
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
    return (
        <span className="text-body-sm font-semibold wrap-anywhere text-muted-foreground">
            {children}
        </span>
    );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
    const id = useId();

    return (
        <div
            role="group"
            aria-labelledby={id}
            className="flex flex-col border-t px-4 py-2"
        >
            <div
                id={id}
                className="py-1 text-overline text-muted-foreground uppercase"
            >
                {label}
            </div>
            {children}
        </div>
    );
}

function SurveyMenuItem({
    icon,
    title,
    description,
    badge,
    disabled,
    onSelect,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    badge?: string;
    disabled: boolean;
    onSelect: () => void;
}) {
    return (
        <DropdownMenuItem
            disabled={disabled}
            onSelect={onSelect}
            className="items-start"
        >
            {icon}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">
                    {description}
                </span>
            </span>
            {badge !== undefined && (
                <Badge variant="secondary" className="shrink-0">
                    {badge}
                </Badge>
            )}
        </DropdownMenuItem>
    );
}

/** "Add survey": the retro's health check, or a quick poll. */
function AddSurveyMenu({
    disabled,
    surveys,
    onAddSurvey,
}: {
    disabled: boolean;
    surveys?: SessionSurveys;
    onAddSurvey: (kind: SurveyKind) => void;
}) {
    const { t } = useTrans();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const chosen = useRef<SurveyKind | null>(null);

    /**
     * The kind chosen is added once the menu is gone: a dialog it opens
     * would otherwise see the menu take the focus back on closing.
     */
    const addChosen = (event: Event) => {
        const kind = chosen.current;

        if (kind === null) {
            return;
        }

        chosen.current = null;
        event.preventDefault();
        triggerRef.current?.focus();
        onAddSurvey(kind);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    ref={triggerRef}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={disabled}
                >
                    <ClipboardList aria-hidden="true" />
                    <span className="truncate">{t('Add survey')}</span>
                    <ChevronDown aria-hidden="true" className="ml-auto" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="w-80 max-w-viewport-gutter"
                onCloseAutoFocus={addChosen}
            >
                <DropdownMenuLabel variant="overline">
                    {t('Add to this retro')}
                </DropdownMenuLabel>
                {surveys !== undefined && (
                    <SurveyMenuItem
                        icon={<HeartPulse aria-hidden="true" />}
                        title={
                            surveys.healthCheckAttached
                                ? t('Health check added')
                                : t('Health check')
                        }
                        description={t(':count statements', {
                            count: surveys.healthCheckStatements,
                        })}
                        badge={t('Built-in survey')}
                        disabled={surveys.healthCheckAttached}
                        onSelect={() => {
                            chosen.current = 'health_check';
                        }}
                    />
                )}
                <SurveyMenuItem
                    icon={<Vote aria-hidden="true" />}
                    title={t('Quick poll')}
                    description={t('One question, answered on the board')}
                    disabled={surveys?.quickPollAvailable === false}
                    onSelect={() => {
                        chosen.current = 'quick_poll';
                    }}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function changedKeysOf(
    draft: Partial<SessionSettingsValues>,
    value: SessionSettingsValues,
): string[] {
    return Object.keys(draft).filter(
        (key) => draft[key] !== undefined && draft[key] !== value[key],
    );
}

function SettingsPanel({
    titleId,
    TitleTag,
    onRequestClose,
    discardPending,
    onKeepEditing,
    onDiscard,
    props,
}: {
    titleId?: string;
    TitleTag: TitleComponent;
    onRequestClose: () => void;
    discardPending: boolean;
    onKeepEditing: () => void;
    onDiscard: () => void;
    props: LooseProps;
}) {
    const { t } = useTrans();
    const baseId = useId();
    const [pending, setPending] = useState(false);
    const {
        title,
        sessionTitle,
        phase,
        phaseLabels,
        groups,
        value,
        draft = {},
        onDraftChange,
        deferred = [],
        errors = {},
        readOnly = false,
        facilitatorName,
        onAddSurvey,
        surveys,
        children,
        onApply,
        onReset,
    } = props;

    const effective = { ...value, ...draft } as SessionSettingsValues;
    const changedKeys = changedKeysOf(draft, value);
    const changeCount = changedKeys.length;
    const isChanged = (key: string): boolean =>
        !readOnly && changedKeys.includes(key);

    const knownPhases: Record<string, string> = {
        icebreaker: t('Icebreaker'),
        writing: t('Writing'),
        grouping: t('Grouping'),
        voting: t('Voting'),
        discussing: t('Discussing'),
        actions: t('Actions'),
        roti: t('ROTI'),
        completed: t('Completed'),
    };

    const phaseLabel = (id: string | undefined): string | undefined =>
        id === undefined ? undefined : (phaseLabels?.[id] ?? knownPhases[id]);

    const isVisible = (setting: SessionSetting): boolean =>
        setting.visibleWhen === undefined ||
        effective[setting.visibleWhen.key] === setting.visibleWhen.equals;

    const allSettings = groups.flatMap((group) => group.settings);
    const settingLabel = (key: string): string =>
        allSettings.find((setting) => setting.key === key)?.label ?? key;

    const missingRequired = allSettings.some(
        (setting) =>
            setting.type === 'text' &&
            setting.required === true &&
            String(effective[setting.key] ?? '').trim() === '',
    );
    const canApply = changeCount > 0 && !missingRequired;

    const setValue = (key: string, next: SettingValue) => {
        const nextDraft: Partial<SessionSettingsValues> = {
            ...draft,
            [key]: next,
        };

        for (const draftKey of Object.keys(nextDraft)) {
            if (nextDraft[draftKey] === value[draftKey]) {
                delete nextDraft[draftKey];
            }
        }

        onDraftChange(nextDraft);
    };

    const deferredWarnings = deferred.filter((entry) =>
        changedKeys.includes(entry.key),
    );

    const apply = async () => {
        if (!canApply || pending) {
            return;
        }

        const patch: Partial<SessionSettingsValues> = {};
        const previous: Partial<SessionSettingsValues> = {};

        for (const key of changedKeys) {
            patch[key] = draft[key];
            previous[key] = value[key];
        }

        setPending(true);

        try {
            await onApply(patch);
        } catch {
            setPending(false);

            return;
        }

        setPending(false);
        onDraftChange({});
        toast.success(t('Settings applied'), {
            duration: 5000,
            action: {
                label: t('Undo'),
                // A refusal is reported by `onApply` itself; the toast has
                // nothing left to do with it.
                onClick: () => {
                    onApply(previous).catch(() => {});
                },
            },
        });
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (readOnly) {
            return;
        }

        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void apply();
        }
    };

    const onOff = (flag: boolean) => (flag ? t('On') : t('Off'));

    const readOnlyText = (setting: SessionSetting): ReactNode => {
        const current = effective[setting.key];

        if (setting.type === 'switch') {
            return current === true
                ? (setting.onLabel ?? onOff(true))
                : (setting.offLabel ?? onOff(false));
        }

        if (setting.type === 'stepper') {
            return current === null
                ? (setting.auto?.valueLabel ?? t('Automatic'))
                : current;
        }

        if (setting.type === 'select') {
            return (
                setting.options.find((option) => option.value === current)
                    ?.label ?? current
            );
        }

        return current;
    };

    const renderSetting = (setting: SessionSetting) => {
        const { key } = setting;
        const labelId = `${baseId}-${key}`;
        const reasonId = `${baseId}-${key}-reason`;
        const reason = readOnly ? undefined : setting.disabledReason;
        const disabled = pending || reason !== undefined;
        const describedBy = reason === undefined ? undefined : reasonId;
        const current = effective[key];
        const changed = isChanged(key);
        const rowProps = {
            labelId,
            label: setting.label,
            help: setting.help,
            reason,
            reasonId,
            error: readOnly ? undefined : errors[key],
            changed,
        };

        if (readOnly) {
            return (
                <SettingRow key={key} {...rowProps}>
                    <ReadOnlyValue>{readOnlyText(setting)}</ReadOnlyValue>
                </SettingRow>
            );
        }

        if (setting.type === 'switch') {
            return (
                <SettingRow key={key} {...rowProps}>
                    <Switch
                        id={setting.id}
                        aria-labelledby={labelId}
                        aria-describedby={describedBy}
                        checked={current === true}
                        disabled={disabled}
                        onCheckedChange={(next) => setValue(key, next)}
                        className={cn(changed && 'ring-2 ring-primary/40')}
                    />
                </SettingRow>
            );
        }

        if (setting.type === 'select') {
            return (
                <SettingRow key={key} {...rowProps}>
                    <Select
                        value={current === null ? '' : String(current)}
                        disabled={disabled}
                        onValueChange={(next) => setValue(key, next)}
                    >
                        <SelectTrigger
                            id={setting.id}
                            aria-labelledby={labelId}
                            aria-describedby={describedBy}
                            className={cn(
                                'h-8 w-40 max-w-full',
                                changed && 'border-primary',
                            )}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {setting.options.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    disabled={option.disabled}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingRow>
            );
        }

        if (setting.type === 'text') {
            const text = String(current ?? '');
            const empty = setting.required === true && text.trim() === '';

            return (
                <SettingRow
                    key={key}
                    {...rowProps}
                    stacked
                    error={
                        empty ? t('This field is required.') : rowProps.error
                    }
                >
                    <Input
                        id={setting.id}
                        aria-labelledby={labelId}
                        aria-describedby={describedBy}
                        aria-invalid={empty ? true : undefined}
                        value={text}
                        maxLength={setting.maxLength}
                        disabled={disabled}
                        onChange={(event) => setValue(key, event.target.value)}
                        className={cn('h-8', changed && 'border-primary')}
                    />
                </SettingRow>
            );
        }

        const { auto } = setting;
        const automatic = current === null;
        const autoLabelId = `${labelId}-auto`;

        return (
            <div key={key} className="flex flex-col">
                <SettingRow {...rowProps}>
                    {automatic ? (
                        <ReadOnlyValue>
                            {auto?.valueLabel ?? t('Automatic')}
                        </ReadOnlyValue>
                    ) : (
                        <Stepper
                            id={setting.id}
                            labelId={labelId}
                            describedBy={describedBy}
                            value={Number(current)}
                            min={setting.min}
                            max={setting.max}
                            changed={changed}
                            disabled={disabled}
                            onChange={(next) => setValue(key, next)}
                        />
                    )}
                </SettingRow>
                {auto !== undefined && (
                    <SettingRow
                        labelId={autoLabelId}
                        label={auto.label}
                        help={automatic ? auto.help : undefined}
                        changed={false}
                        nested
                    >
                        <Switch
                            id={auto.id}
                            aria-labelledby={autoLabelId}
                            aria-describedby={describedBy}
                            checked={automatic}
                            disabled={disabled}
                            onCheckedChange={(next) =>
                                setValue(
                                    key,
                                    next
                                        ? null
                                        : Math.min(
                                              Math.max(
                                                  auto.fallback,
                                                  setting.min,
                                              ),
                                              setting.max,
                                          ),
                                )
                            }
                        />
                    </SettingRow>
                )}
            </div>
        );
    };

    const currentPhase = phaseLabel(phase);
    const titleProps = titleId === undefined ? {} : { id: titleId };

    return (
        <div
            onKeyDown={onKeyDown}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
            <div className="flex items-start gap-2 pt-3 pr-3 pb-2 pl-4">
                {readOnly ? (
                    <Lock
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                ) : (
                    <Settings2
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-skrum-primary-text"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <TitleTag
                        {...titleProps}
                        className="truncate text-ui-lg font-semibold"
                    >
                        {title ?? t('Session settings')}
                    </TitleTag>
                    <p className="truncate text-xs text-muted-foreground">
                        {sessionTitle}
                        {currentPhase !== undefined && ` · ${currentPhase}`}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('Close')}
                    onClick={onRequestClose}
                >
                    <X aria-hidden="true" />
                </Button>
            </div>

            {readOnly && (
                <Alert className="mx-4 mb-3 w-auto bg-muted text-body-sm text-muted-foreground">
                    <Lock aria-hidden="true" />
                    <span>
                        {facilitatorName === undefined
                            ? t(
                                  'Only the facilitator can change these settings.',
                              )
                            : t(
                                  'Only the facilitator, :name, can change these settings.',
                                  { name: facilitatorName },
                              )}
                    </span>
                </Alert>
            )}

            {groups.map((group) => {
                const visible = group.settings.filter(isVisible);

                if (visible.length === 0) {
                    return null;
                }

                return (
                    <Group key={group.id} label={group.label}>
                        {visible.map(renderSetting)}
                    </Group>
                );
            })}

            {children !== undefined && (
                <div className="flex flex-col gap-2 border-t px-4 py-3">
                    {children}
                </div>
            )}

            {!readOnly && onAddSurvey !== undefined && (
                <div className="flex flex-col gap-2 border-t px-4 py-3">
                    <AddSurveyMenu
                        disabled={pending}
                        surveys={surveys}
                        onAddSurvey={onAddSurvey}
                    />
                </div>
            )}

            {!readOnly && deferredWarnings.length > 0 && (
                <Alert
                    variant="warning"
                    className="mx-4 mb-3 w-auto gap-2 px-3 py-2 text-body-sm"
                >
                    <div className="col-start-2 flex min-w-0 flex-col gap-1">
                        {deferredWarnings.map((entry) => {
                            const from = phaseLabel(entry.fromPhase);

                            return (
                                <p key={entry.key}>
                                    {from === undefined
                                        ? t(
                                              ':setting applies from the next phase. The current one keeps running.',
                                              {
                                                  setting: settingLabel(
                                                      entry.key,
                                                  ),
                                              },
                                          )
                                        : t(
                                              ':setting applies from the next phase (:phase). The current one keeps running.',
                                              {
                                                  setting: settingLabel(
                                                      entry.key,
                                                  ),
                                                  phase: from,
                                              },
                                          )}
                                </p>
                            );
                        })}
                    </div>
                </Alert>
            )}

            {!readOnly && (
                <div
                    data-slot="session-settings-footer"
                    className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-between gap-2 border-t bg-muted py-2 pr-3 pl-4"
                >
                    {discardPending ? (
                        <>
                            <p
                                role="alert"
                                className="min-w-0 flex-1 basis-36 text-xs text-foreground"
                            >
                                {t('Discard :count changes?', {
                                    count: changeCount,
                                })}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={onKeepEditing}
                                >
                                    <span className="truncate">
                                        {t('Keep editing')}
                                    </span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={onDiscard}
                                >
                                    <X aria-hidden="true" />
                                    <span className="truncate">
                                        {t('Discard')}
                                    </span>
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p
                                role="status"
                                className="min-w-0 flex-1 basis-36 text-xs text-muted-foreground"
                            >
                                {changeCount === 0
                                    ? t('No changes')
                                    : changeCount === 1
                                      ? t('1 unapplied change')
                                      : t(':count unapplied changes', {
                                            count: changeCount,
                                        })}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={changeCount === 0 || pending}
                                    onClick={onReset}
                                >
                                    <span className="truncate">
                                        {t('Reset')}
                                    </span>
                                </Button>
                                <LoadingButton
                                    type="button"
                                    size="sm"
                                    loader="trema"
                                    loading={pending}
                                    disabled={!canApply}
                                    title={t('Apply (:shortcut)', {
                                        shortcut: isMacLike() ? '⌘↵' : 'Ctrl ↵',
                                    })}
                                    onClick={() => void apply()}
                                    className="min-w-0"
                                >
                                    <span className="truncate">
                                        {changeCount === 0
                                            ? t('Apply')
                                            : t('Apply (:count)', {
                                                  count: changeCount,
                                              })}
                                    </span>
                                </LoadingButton>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function SessionSettingsPopover<
    V extends SessionSettingsValues = SessionSettingsValues,
>(typedProps: SessionSettingsPopoverProps<V>) {
    const props = typedProps as unknown as LooseProps;
    const { open, onOpenChange, draft = {}, value, trigger, onReset } = props;
    const { anchorRef } = props;
    const isMobile = useIsMobile();
    const variant = props.variant ?? (isMobile ? 'drawer' : 'popover');
    const titleId = useId();
    const [discardPending, setDiscardPending] = useState(false);
    const wasOpen = useRef(open);
    const openerRef = useRef<HTMLElement | null>(null);
    const openerTracked = useRef(false);

    // The opener is read while rendering: once the overlay is mounted, focus
    // has already moved inside it.
    if (open && !openerTracked.current) {
        openerRef.current =
            document.activeElement instanceof HTMLElement &&
            document.activeElement !== document.body
                ? document.activeElement
                : null;
    }

    openerTracked.current = open;

    const guarded = !props.readOnly && changedKeysOf(draft, value).length > 0;

    useEffect(() => {
        if (wasOpen.current && !open) {
            setDiscardPending(false);
        }

        wasOpen.current = open;
    }, [open]);

    const requestOpenChange = (next: boolean) => {
        if (!next && guarded) {
            setDiscardPending(true);

            return;
        }

        onOpenChange(next);
    };

    const returnFocus = (event: Event) => {
        const target = anchorRef?.current ?? openerRef.current;
        const active = document.activeElement;
        const focusIsLost = active === null || active === document.body;

        if (target === null || !target.isConnected || !focusIsLost) {
            return;
        }

        event.preventDefault();
        target.focus();
    };

    const onCloseAutoFocus = trigger === undefined ? returnFocus : undefined;
    const virtualAnchor =
        anchorRef ?? (openerRef.current === null ? undefined : openerRef);

    const panel = (TitleTag: TitleComponent, id?: string) => (
        <SettingsPanel
            titleId={id}
            TitleTag={TitleTag}
            onRequestClose={() => requestOpenChange(false)}
            discardPending={discardPending}
            onKeepEditing={() => setDiscardPending(false)}
            onDiscard={() => {
                setDiscardPending(false);
                onReset();
                onOpenChange(false);
            }}
            props={props}
        />
    );

    if (variant === 'drawer') {
        return (
            <Drawer open={open} onOpenChange={requestOpenChange}>
                {trigger !== undefined && (
                    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                )}
                <DrawerContent
                    showCloseButton={false}
                    aria-describedby={undefined}
                    onCloseAutoFocus={onCloseAutoFocus}
                    className="px-0 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
                >
                    {panel(DrawerTitle)}
                </DrawerContent>
            </Drawer>
        );
    }

    if (variant === 'sheet') {
        return (
            <DialogPrimitive.Root
                open={open}
                onOpenChange={requestOpenChange}
                modal={false}
            >
                {trigger !== undefined && (
                    <DialogPrimitive.Trigger asChild>
                        {trigger}
                    </DialogPrimitive.Trigger>
                )}
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        onInteractOutside={(event) => event.preventDefault()}
                        onCloseAutoFocus={onCloseAutoFocus}
                        className="fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col gap-0 border-l bg-popover p-0 text-popover-foreground shadow-modal outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:duration-(--duration-slow) data-[state=open]:ease-(--ease-enter) data-[state=open]:slide-in-from-right motion-reduce:data-[state=closed]:slide-out-to-right-0 motion-reduce:data-[state=open]:slide-in-from-right-0 sm:max-w-100"
                    >
                        {panel(DialogPrimitive.Title)}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        );
    }

    return (
        <Popover open={open} onOpenChange={requestOpenChange}>
            {trigger !== undefined ? (
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            ) : (
                <PopoverAnchor
                    virtualRef={virtualAnchor as RefObject<HTMLElement>}
                />
            )}
            <PopoverContent
                role="dialog"
                aria-labelledby={titleId}
                align="end"
                onCloseAutoFocus={onCloseAutoFocus}
                className="flex max-h-(--radix-popover-content-available-height) w-92 max-w-viewport-gutter flex-col overflow-hidden p-0"
            >
                {panel('h2', titleId)}
            </PopoverContent>
        </Popover>
    );
}

export function SessionSettingsContent<
    V extends SessionSettingsValues = SessionSettingsValues,
>(props: SessionSettingsPopoverProps<V>) {
    const titleId = useId();

    return (
        <section
            aria-labelledby={titleId}
            className="flex min-h-0 flex-1 flex-col"
        >
            <SettingsPanel
                titleId={titleId}
                TitleTag="h2"
                onRequestClose={() => props.onOpenChange(false)}
                discardPending={false}
                onKeepEditing={() => {}}
                onDiscard={() => {}}
                props={props as unknown as LooseProps}
            />
        </section>
    );
}
