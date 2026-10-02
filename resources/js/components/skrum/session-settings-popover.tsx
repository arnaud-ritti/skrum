import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    ChevronDown,
    ClipboardList,
    Lock,
    Minus,
    Plus,
    Settings2,
    X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, KeyboardEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type TitleComponent =
    | 'h2'
    | ComponentType<{ id: string; className?: string; children?: ReactNode }>;

export type RetroPhase =
    | 'icebreaker'
    | 'writing'
    | 'grouping'
    | 'voting'
    | 'discussing'
    | 'actions'
    | 'roti';

export type SessionSettings = {
    anonymousCards: boolean;
    boardLocked: boolean;
    votesPerPerson: number;
    maxVotesPerCard: number;
    hideVotesUntilReveal: boolean;
    phaseTimerMinutes: number | null;
    showCursors: boolean;
    reactionsEnabled: boolean;
};

export type SurveyChoice =
    | 'health_check'
    | 'quick_poll'
    | { templateId: string };

export type SessionSettingsPopoverProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionTitle: string;
    phase: RetroPhase;
    value: SessionSettings;
    draft?: Partial<SessionSettings>;
    onDraftChange: (draft: Partial<SessionSettings>) => void;
    deferred?: { key: keyof SessionSettings; fromPhase: RetroPhase }[];
    readOnly?: boolean;
    facilitatorName?: string;
    surveys?: {
        healthCheckStatements: number;
        templates: { id: string; title: string }[];
    };
    attachedSurvey?: string;
    onAddSurvey: (kind: SurveyChoice) => void;
    onApply: (patch: Partial<SessionSettings>) => Promise<void>;
    onReset: () => void;
    variant?: 'popover' | 'sheet' | 'drawer';
    trigger?: ReactNode;
};

const timerOptions = [3, 5, 7, 10, 15];
const timedPhases: RetroPhase[] = ['writing', 'grouping', 'voting'];
const minVotes = 1;
const maxVotes = 10;

function isMacLike(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad/.test(navigator.platform)
    );
}

function Stepper({
    labelId,
    value,
    min,
    max,
    changed,
    disabled,
    onChange,
}: {
    labelId: string;
    value: number;
    min: number;
    max: number;
    changed: boolean;
    disabled: boolean;
    onChange: (value: number) => void;
}) {
    const { t } = useTrans();

    const onKeyDown = (event: KeyboardEvent<HTMLOutputElement>) => {
        if (event.key === 'ArrowUp' && value < max) {
            event.preventDefault();
            onChange(value + 1);
        }

        if (event.key === 'ArrowDown' && value > min) {
            event.preventDefault();
            onChange(value - 1);
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
            <output
                tabIndex={disabled ? -1 : 0}
                aria-live="polite"
                onKeyDown={onKeyDown}
                className="min-w-8 border-x text-center text-sm font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {value}
            </output>
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

function SettingSwitch({
    labelId,
    checked,
    changed,
    disabled,
    onChange,
}: {
    labelId: string;
    checked: boolean;
    changed: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <Switch
            aria-labelledby={labelId}
            checked={checked}
            disabled={disabled}
            onCheckedChange={onChange}
            className={cn(changed && 'ring-2 ring-primary/40')}
        />
    );
}

function SettingRow({
    id,
    label,
    help,
    changed,
    children,
}: {
    id: string;
    label: string;
    help?: string;
    changed: boolean;
    children: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1">
            <div className="min-w-0 flex-1 basis-36">
                <div className="flex items-center gap-1.5">
                    {changed && (
                        <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-primary"
                        />
                    )}
                    <span
                        id={id}
                        className="min-w-0 text-body-sm font-semibold"
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
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
    return (
        <span className="text-body-sm font-semibold text-muted-foreground">
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

function sameValue(
    first: SessionSettings[keyof SessionSettings],
    second: SessionSettings[keyof SessionSettings],
): boolean {
    return first === second;
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
    titleId: string;
    TitleTag: TitleComponent;
    onRequestClose: () => void;
    discardPending: boolean;
    onKeepEditing: () => void;
    onDiscard: () => void;
    props: SessionSettingsPopoverProps;
}) {
    const { t } = useTrans();
    const baseId = useId();
    const [pending, setPending] = useState(false);
    const {
        sessionTitle,
        phase,
        value,
        draft = {},
        onDraftChange,
        deferred = [],
        readOnly = false,
        facilitatorName,
        surveys,
        attachedSurvey,
        onAddSurvey,
        onApply,
        onReset,
    } = props;

    const effective: SessionSettings = { ...value, ...draft };
    const changedKeys = (Object.keys(draft) as (keyof SessionSettings)[])
        .filter((key) => draft[key] !== undefined)
        .filter((key) => !sameValue(draft[key]!, value[key]));
    const changeCount = changedKeys.length;
    const isChanged = (key: keyof SessionSettings): boolean =>
        changedKeys.includes(key);

    const phaseLabels: Record<RetroPhase, string> = {
        icebreaker: t('Icebreaker'),
        writing: t('Writing'),
        grouping: t('Grouping'),
        voting: t('Voting'),
        discussing: t('Discussion'),
        actions: t('Actions'),
        roti: t('ROTI'),
    };

    const settingLabels: Record<keyof SessionSettings, string> = {
        anonymousCards: t('Anonymous cards'),
        boardLocked: t('Lock board'),
        votesPerPerson: t('Votes per person'),
        maxVotesPerCard: t('Max per card'),
        hideVotesUntilReveal: t('Hide votes until reveal'),
        phaseTimerMinutes: t('Timer per phase'),
        showCursors: t('Show cursors'),
        reactionsEnabled: t('Reactions'),
    };

    const setValue = <K extends keyof SessionSettings>(
        key: K,
        next: SessionSettings[K],
    ) => {
        const nextDraft: Partial<SessionSettings> = { ...draft, [key]: next };

        if (key === 'votesPerPerson') {
            const votes = next as number;

            if (effective.maxVotesPerCard > votes) {
                nextDraft.maxVotesPerCard = votes;
            }
        }

        for (const draftKey of Object.keys(
            nextDraft,
        ) as (keyof SessionSettings)[]) {
            if (sameValue(nextDraft[draftKey]!, value[draftKey])) {
                delete nextDraft[draftKey];
            }
        }

        onDraftChange(nextDraft);
    };

    const deferredWarnings = deferred.filter((entry) =>
        changedKeys.includes(entry.key),
    );

    const apply = async () => {
        if (changeCount === 0 || pending) {
            return;
        }

        const patch: Partial<SessionSettings> = {};
        const previous: Partial<SessionSettings> = {};

        for (const key of changedKeys) {
            (patch as Record<string, unknown>)[key] = draft[key];
            (previous as Record<string, unknown>)[key] = value[key];
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
                onClick: () => {
                    void onApply(previous);
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

    const id = (key: string) => `${baseId}-${key}`;
    const onOff = (flag: boolean) => (flag ? t('On') : t('Off'));
    const disabled = pending;
    const timerValue =
        effective.phaseTimerMinutes === null
            ? 'off'
            : String(effective.phaseTimerMinutes);
    const timerText =
        effective.phaseTimerMinutes === null
            ? t('Off')
            : t(':minutes min', { minutes: effective.phaseTimerMinutes });
    const timerHelp = timedPhases.map((key) => phaseLabels[key]).join(' · ');

    const row = (
        key: keyof SessionSettings,
        help: string | undefined,
        control: ReactNode,
        readOnlyText: ReactNode,
    ) => (
        <SettingRow
            id={id(key)}
            label={settingLabels[key]}
            help={help}
            changed={!readOnly && isChanged(key)}
        >
            {readOnly ? <ReadOnlyValue>{readOnlyText}</ReadOnlyValue> : control}
        </SettingRow>
    );

    const switchRow = (
        key:
            | 'anonymousCards'
            | 'hideVotesUntilReveal'
            | 'showCursors'
            | 'reactionsEnabled'
            | 'boardLocked',
        help?: string,
        readOnlyText?: string,
    ) =>
        row(
            key,
            help,
            <SettingSwitch
                labelId={id(key)}
                checked={effective[key]}
                changed={isChanged(key)}
                disabled={disabled}
                onChange={(next) => setValue(key, next)}
            />,
            readOnlyText ?? onOff(effective[key]),
        );

    const attachedLabel = attachedSurvey;

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
                        id={titleId}
                        className="truncate text-ui-lg font-semibold"
                    >
                        {t('Session settings')}
                    </TitleTag>
                    <p className="truncate text-xs text-muted-foreground">
                        {sessionTitle} · {phaseLabels[phase]}
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

            <Group label={t('Cards')}>
                {switchRow('anonymousCards', t('Authors hidden from everyone'))}
                {switchRow(
                    'boardLocked',
                    t('No new cards or edits'),
                    effective.boardLocked ? t('Locked') : t('Unlocked'),
                )}
            </Group>

            <Group label={t('Voting')}>
                {row(
                    'votesPerPerson',
                    undefined,
                    <Stepper
                        labelId={id('votesPerPerson')}
                        value={effective.votesPerPerson}
                        min={minVotes}
                        max={maxVotes}
                        changed={isChanged('votesPerPerson')}
                        disabled={disabled}
                        onChange={(next) => setValue('votesPerPerson', next)}
                    />,
                    effective.votesPerPerson,
                )}
                {row(
                    'maxVotesPerCard',
                    undefined,
                    <Stepper
                        labelId={id('maxVotesPerCard')}
                        value={effective.maxVotesPerCard}
                        min={minVotes}
                        max={effective.votesPerPerson}
                        changed={isChanged('maxVotesPerCard')}
                        disabled={disabled}
                        onChange={(next) => setValue('maxVotesPerCard', next)}
                    />,
                    effective.maxVotesPerCard,
                )}
                {switchRow(
                    'hideVotesUntilReveal',
                    t('Counts stay secret while voting'),
                )}
            </Group>

            <Group label={t('Timer')}>
                {row(
                    'phaseTimerMinutes',
                    timerHelp,
                    <Select
                        value={timerValue}
                        disabled={disabled}
                        onValueChange={(next) =>
                            setValue(
                                'phaseTimerMinutes',
                                next === 'off' ? null : Number(next),
                            )
                        }
                    >
                        <SelectTrigger
                            aria-labelledby={id('phaseTimerMinutes')}
                            className={cn(
                                'h-8 w-30',
                                isChanged('phaseTimerMinutes') &&
                                    'border-primary',
                            )}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="off">{t('Off')}</SelectItem>
                            {timerOptions.map((minutes) => (
                                <SelectItem
                                    key={minutes}
                                    value={String(minutes)}
                                >
                                    {t(':minutes min', { minutes })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>,
                    timerText,
                )}
            </Group>

            <Group label={t('Presence')}>
                {switchRow('showCursors')}
                {switchRow('reactionsEnabled')}
            </Group>

            {!readOnly && surveys !== undefined && (
                <div className="flex flex-col gap-2 border-t px-4 py-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                disabled={disabled}
                            >
                                <ClipboardList aria-hidden="true" />
                                <span className="truncate">
                                    {attachedLabel === undefined
                                        ? t('Add survey')
                                        : t(':survey added · Edit', {
                                              survey: attachedLabel,
                                          })}
                                </span>
                                <ChevronDown
                                    aria-hidden="true"
                                    className="ml-auto"
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-80">
                            <DropdownMenuItem
                                className="h-auto items-start py-1.5"
                                onSelect={() => onAddSurvey('health_check')}
                            >
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="flex items-center gap-2">
                                        <span className="truncate font-semibold">
                                            {t('Health check')}
                                        </span>
                                        <Badge variant="secondary">
                                            {t('Built-in')}
                                        </Badge>
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {t(':count statements', {
                                            count: surveys.healthCheckStatements,
                                        })}
                                    </span>
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="h-auto items-start py-1.5"
                                onSelect={() => onAddSurvey('quick_poll')}
                            >
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-semibold">
                                        {t('Quick poll')}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {t('One question, answered live')}
                                    </span>
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger
                                    className="h-auto items-start py-1.5"
                                    disabled={surveys.templates.length === 0}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate font-semibold">
                                            {t('From a template…')}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {t(
                                                'Surveys shared by the workspace',
                                            )}
                                        </span>
                                    </span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-64">
                                    {surveys.templates.map((template) => (
                                        <DropdownMenuItem
                                            key={template.id}
                                            onSelect={() =>
                                                onAddSurvey({
                                                    templateId: template.id,
                                                })
                                            }
                                        >
                                            <span className="truncate">
                                                {template.title}
                                            </span>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="text-xs text-muted-foreground">
                        {t('Shown after Actions, before the ROTI.')}
                    </p>
                </div>
            )}

            {!readOnly && deferredWarnings.length > 0 && (
                <Alert
                    variant="warning"
                    className="mx-4 mb-3 w-auto gap-2 px-3 py-2 text-body-sm"
                >
                    <div className="col-start-2 flex min-w-0 flex-col gap-1">
                        {deferredWarnings.map((entry) => (
                            <p key={entry.key}>
                                {t(
                                    ':setting applies from the next phase (:phase). The current one keeps running.',
                                    {
                                        setting: settingLabels[entry.key],
                                        phase: phaseLabels[entry.fromPhase],
                                    },
                                )}
                            </p>
                        ))}
                    </div>
                </Alert>
            )}

            {!readOnly && (
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t bg-muted py-2 pr-3 pl-4">
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
                                    {t('Keep editing')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={onDiscard}
                                >
                                    <X aria-hidden="true" />
                                    {t('Discard')}
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
                                    {t('Reset')}
                                </Button>
                                <LoadingButton
                                    type="button"
                                    size="sm"
                                    loader="trema"
                                    loading={pending}
                                    disabled={changeCount === 0}
                                    title={t('Apply (:shortcut)', {
                                        shortcut: isMacLike() ? '⌘↵' : 'Ctrl ↵',
                                    })}
                                    onClick={() => void apply()}
                                >
                                    {changeCount === 0
                                        ? t('Apply')
                                        : t('Apply (:count)', {
                                              count: changeCount,
                                          })}
                                </LoadingButton>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function SessionSettingsPopover(props: SessionSettingsPopoverProps) {
    const { open, onOpenChange, draft = {}, value, trigger, onReset } = props;
    const isMobile = useIsMobile();
    const variant = props.variant ?? (isMobile ? 'drawer' : 'popover');
    const titleId = useId();
    const [discardPending, setDiscardPending] = useState(false);
    const wasOpen = useRef(open);

    const dirtyCount = (Object.keys(draft) as (keyof SessionSettings)[]).filter(
        (key) => draft[key] !== undefined && draft[key] !== value[key],
    ).length;
    const guarded = !props.readOnly && dirtyCount > 0;

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

    const panel = (TitleTag: TitleComponent) => (
        <SettingsPanel
            titleId={titleId}
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
                <DrawerContent
                    showCloseButton={false}
                    aria-describedby={undefined}
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
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        onInteractOutside={(event) => event.preventDefault()}
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
                <PopoverAnchor />
            )}
            <PopoverContent
                role="dialog"
                aria-labelledby={titleId}
                align="end"
                sideOffset={6}
                className="z-50 flex max-h-(--radix-popover-content-available-height) w-92 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-popover outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
            >
                {panel('h2')}
            </PopoverContent>
        </Popover>
    );
}

export function SessionSettingsContent(props: SessionSettingsPopoverProps) {
    const titleId = useId();

    return (
        <SettingsPanel
            titleId={titleId}
            TitleTag="h2"
            onRequestClose={() => props.onOpenChange(false)}
            discardPending={false}
            onKeepEditing={() => {}}
            onDiscard={() => {}}
            props={props}
        />
    );
}
