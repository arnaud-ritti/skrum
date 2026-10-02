import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    SessionSettingsContent,
    SessionSettingsPopover,
    useRetroSettingGroups,
} from '@/components/skrum/session-settings-popover';
import type {
    RetroSettingsContext,
    RetroSettingsValues,
    SessionSettingGroup,
    SessionSettingsPopoverProps,
    SessionSettingsValues,
} from '@/components/skrum/session-settings-popover';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const applied: RetroSettingsValues = {
    title: 'Sprint 42',
    is_anonymous: true,
    votes_per_participant: 5,
    health_check_enabled: true,
    icebreaker_enabled: true,
    icebreaker_game: 'draw',
    reactions_enabled: true,
    cursors_enabled: true,
    gifs_enabled: true,
    hide_vote_counts: false,
    is_locked: false,
    presentation_mode: false,
    ai_summary_enabled: false,
};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Frame({ children }: { children: ReactNode }) {
    return (
        <div className="flex w-full max-w-92 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-popover">
            {children}
        </div>
    );
}

type RetroProps = Partial<SessionSettingsPopoverProps<RetroSettingsValues>> & {
    initialDraft?: Partial<RetroSettingsValues>;
    initialValue?: Partial<RetroSettingsValues>;
    context?: Partial<RetroSettingsContext>;
};

function Retro({
    initialDraft = {},
    initialValue = {},
    context = {},
    ...props
}: RetroProps) {
    const { t } = useTrans();
    const [draft, setDraft] = useState(initialDraft);
    const [value, setValue] = useState({
        ...applied,
        title: t('Sprint 42 retro'),
        ...initialValue,
    });
    const phase = context.phase ?? 'writing';
    const groups = useRetroSettingGroups({
        phase,
        isAnonymous: value.is_anonymous,
        icebreakerGame: value.icebreaker_game,
        votesPerParticipant: value.votes_per_participant ?? 7,
        hasCards: false,
        icebreakerGames: [
            { value: 'draw', label: t('Draw and guess'), available: true },
            { value: 'gif', label: t('GIF battle'), available: false },
            { value: 'hangman', label: t('Hangman'), available: true },
            { value: 'decoded', label: t('Decoded'), available: true },
        ],
        gifProvider: 'giphy',
        llmProvider: 'Mistral',
        ...context,
    });

    return (
        <Frame>
            <SessionSettingsContent
                open
                onOpenChange={() => {}}
                sessionTitle={value.title}
                phase={phase}
                groups={groups}
                value={value}
                draft={draft}
                onDraftChange={setDraft}
                onAddSurvey={() => {}}
                onApply={async (patch) => {
                    setValue((current) => ({ ...current, ...patch }));
                }}
                onReset={() => setDraft({})}
                {...props}
            />
        </Frame>
    );
}

function usePokerGroups(): SessionSettingGroup[] {
    const { t } = useTrans();

    return [
        {
            id: 'general',
            label: t('General'),
            settings: [
                {
                    type: 'text',
                    key: 'title',
                    id: 'poker-title',
                    label: t('Title'),
                    maxLength: 120,
                    required: true,
                },
                {
                    type: 'switch',
                    key: 'guest_access_enabled',
                    id: 'poker-guest-access',
                    label: t('Allow guests'),
                },
            ],
        },
        {
            id: 'votes',
            label: t('Voting'),
            settings: [
                {
                    type: 'switch',
                    key: 'auto_reveal',
                    id: 'poker-auto-reveal',
                    label: t(
                        'Reveal automatically when everyone has voted or the timer ends',
                    ),
                },
                {
                    type: 'switch',
                    key: 'anonymous_votes',
                    id: 'poker-anonymous-votes',
                    label: t('Anonymous votes'),
                    help: t(
                        "With two voters, each can work out the other's vote from their own.",
                    ),
                },
            ],
        },
        {
            id: 'presence',
            label: t('Presence'),
            settings: [
                {
                    type: 'switch',
                    key: 'cursors_enabled',
                    id: 'poker-cursors',
                    label: t('Show live cursors'),
                },
                {
                    type: 'switch',
                    key: 'reactions_enabled',
                    id: 'poker-reactions',
                    label: t('Show flying reactions'),
                },
            ],
        },
    ];
}

function Poker() {
    const { t } = useTrans();
    const groups = usePokerGroups();
    const [draft, setDraft] = useState<Partial<SessionSettingsValues>>({});
    const [value, setValue] = useState<SessionSettingsValues>({
        title: t('Sprint 43 planning'),
        guest_access_enabled: true,
        auto_reveal: false,
        anonymous_votes: true,
        cursors_enabled: true,
        reactions_enabled: false,
    });

    return (
        <Frame>
            <SessionSettingsContent
                open
                onOpenChange={() => {}}
                title={t('Game settings')}
                sessionTitle={String(value.title)}
                groups={groups}
                value={value}
                draft={draft}
                onDraftChange={setDraft}
                onApply={async (patch) => {
                    setValue(
                        (current) =>
                            ({ ...current, ...patch }) as SessionSettingsValues,
                    );
                }}
                onReset={() => setDraft({})}
            >
                <p className="text-xs text-muted-foreground">
                    {t("The deck can't change once votes exist.")}
                </p>
            </SessionSettingsContent>
        </Frame>
    );
}

function useWhiteboardGroups(): SessionSettingGroup[] {
    const { t } = useTrans();

    return [
        {
            id: 'board',
            label: t('Board'),
            settings: [
                {
                    type: 'switch',
                    key: 'locked',
                    label: t('Close for editing'),
                    onLabel: t('Locked'),
                    offLabel: t('Unlocked'),
                },
                {
                    type: 'switch',
                    key: 'follow_enabled',
                    label: t('Follow the facilitator'),
                },
                {
                    type: 'switch',
                    key: 'guest_access_enabled',
                    label: t('Allow guests'),
                },
            ],
        },
        {
            id: 'presence',
            label: t('Presence'),
            settings: [
                {
                    type: 'switch',
                    key: 'cursors_enabled',
                    label: t('Show live cursors'),
                },
                {
                    type: 'switch',
                    key: 'reactions_enabled',
                    label: t('Show reactions'),
                },
            ],
        },
    ];
}

function Live({
    variant,
    label,
    defaultOpen = false,
}: {
    variant: 'popover' | 'sheet' | 'drawer';
    label: string;
    defaultOpen?: boolean;
}) {
    const { t } = useTrans();
    const groups = useWhiteboardGroups();
    const [open, setOpen] = useState(defaultOpen);
    const [draft, setDraft] = useState<Partial<SessionSettingsValues>>({});
    const [value, setValue] = useState<SessionSettingsValues>({
        locked: false,
        follow_enabled: true,
        guest_access_enabled: false,
        cursors_enabled: true,
        reactions_enabled: true,
    });

    return (
        <SessionSettingsPopover
            open={open}
            onOpenChange={setOpen}
            variant={variant}
            title={t('Whiteboard settings')}
            sessionTitle={t('Architecture workshop')}
            groups={groups}
            value={value}
            draft={draft}
            onDraftChange={setDraft}
            onApply={async (patch) => {
                setValue(
                    (current) =>
                        ({ ...current, ...patch }) as SessionSettingsValues,
                );
            }}
            onReset={() => setDraft({})}
            trigger={
                <Button type="button" variant="outline" size="sm">
                    <Settings2 aria-hidden="true" />
                    <span className="truncate">{label}</span>
                </Button>
            }
        />
    );
}

export default function SessionSettingsPopoverSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t(
                    'Live containers, with whiteboard settings: the popover is open. Change a value, then try to close to see the discard confirmation. Apply shows the toast.',
                )}
            >
                <div className="flex h-120 flex-wrap items-start gap-3">
                    <Live
                        variant="popover"
                        label={t('Open popover')}
                        defaultOpen
                    />
                    <Live variant="sheet" label={t('Open sheet')} />
                    <Live variant="drawer" label={t('Open drawer')} />
                </div>
            </Example>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] items-start gap-6">
                <Example
                    label={t('Retro, writing phase (facilitator, no change)')}
                >
                    <Retro />
                </Example>
                <Example
                    label={t(
                        'Modified, not applied, with next-phase warning; vote limit locked since voting started',
                    )}
                >
                    <Retro
                        context={{ phase: 'voting', hasCards: true }}
                        initialDraft={{
                            hide_vote_counts: true,
                            is_locked: true,
                        }}
                        deferred={[
                            {
                                key: 'hide_vote_counts',
                                fromPhase: 'discussing',
                            },
                        ]}
                    />
                </Example>
                <Example
                    label={t(
                        'Automatic vote limit, health check phase (cannot be turned off)',
                    )}
                >
                    <Retro
                        context={{ phase: 'health_check' }}
                        initialValue={{ votes_per_participant: null }}
                    />
                </Example>
                <Example label={t('Applying (click Apply: it never resolves)')}>
                    <Retro
                        initialDraft={{ is_locked: true }}
                        onApply={() => new Promise<void>(() => {})}
                    />
                </Example>
                <Example label={t('Server error on a setting')}>
                    <Retro
                        errors={{ ai_summary_enabled: t('Not available.') }}
                    />
                </Example>
                <Example label={t('Completed retro: only the title changes')}>
                    <Retro
                        context={{ phase: 'completed', hasCards: true }}
                        onAddSurvey={undefined}
                    />
                </Example>
                <Example
                    label={t(
                        'A phase added later (ROTI), no GIF or AI provider, maximum of 20 votes',
                    )}
                >
                    <Retro
                        context={{
                            phase: 'roti',
                            gifProvider: null,
                            llmProvider: null,
                        }}
                        initialValue={{
                            votes_per_participant: 20,
                            icebreaker_enabled: false,
                        }}
                    />
                </Example>
                <Example label={t('Title of 120 characters, empty draft')}>
                    <Retro
                        initialValue={{
                            title: t(
                                'End-of-quarter retrospective for the whole platform, payments and billing team, with the external partners',
                            ),
                        }}
                        initialDraft={{ title: '' }}
                    />
                </Example>
                <Example label={t('Read-only (participant)')}>
                    <Retro readOnly facilitatorName="Camille R." />
                </Example>
                <Example
                    label={t(
                        'Planning poker settings through the same component, with a slot',
                    )}
                >
                    <Poker />
                </Example>
            </div>
        </div>
    );
}
