import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    SessionSettingsContent,
    SessionSettingsPopover,
} from '@/components/skrum/session-settings-popover';
import type {
    SessionSettings,
    SessionSettingsPopoverProps,
} from '@/components/skrum/session-settings-popover';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const applied: SessionSettings = {
    anonymousCards: true,
    boardLocked: false,
    votesPerPerson: 5,
    maxVotesPerCard: 2,
    hideVotesUntilReveal: false,
    phaseTimerMinutes: 5,
    showCursors: true,
    reactionsEnabled: true,
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

function Stateful({
    initialDraft = {},
    ...props
}: Partial<SessionSettingsPopoverProps> & {
    initialDraft?: Partial<SessionSettings>;
}) {
    const { t } = useTrans();
    const [draft, setDraft] = useState(initialDraft);
    const [value, setValue] = useState(applied);

    return (
        <Frame>
            <SessionSettingsContent
                open
                onOpenChange={() => {}}
                sessionTitle={t('Sprint 42 retro')}
                phase="writing"
                value={value}
                draft={draft}
                onDraftChange={setDraft}
                surveys={{
                    healthCheckStatements: 6,
                    templates: [{ id: 't1', title: t('Mad Sad Glad') }],
                }}
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

function Live({
    variant,
    label,
}: {
    variant: 'popover' | 'sheet' | 'drawer';
    label: string;
}) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<Partial<SessionSettings>>({});
    const [value, setValue] = useState(applied);

    return (
        <SessionSettingsPopover
            open={open}
            onOpenChange={setOpen}
            variant={variant}
            sessionTitle={t('Sprint 42 retro')}
            phase="writing"
            value={value}
            draft={draft}
            onDraftChange={setDraft}
            deferred={[{ key: 'phaseTimerMinutes', fromPhase: 'grouping' }]}
            surveys={{
                healthCheckStatements: 6,
                templates: [{ id: 't1', title: t('Mad Sad Glad') }],
            }}
            onAddSurvey={() => {}}
            onApply={async (patch) => {
                setValue((current) => ({ ...current, ...patch }));
            }}
            onReset={() => setDraft({})}
            trigger={
                <Button type="button" variant="outline" size="sm">
                    <Settings2 aria-hidden="true" />
                    {label}
                </Button>
            }
        />
    );
}

export default function SessionSettingsPopoverSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] items-start gap-6">
                <Example label={t('Default (facilitator, nothing modified)')}>
                    <Stateful />
                </Example>
                <Example
                    label={t('Modified, not applied, with next-phase warning')}
                >
                    <Stateful
                        initialDraft={{
                            votesPerPerson: 6,
                            phaseTimerMinutes: 7,
                        }}
                        phase="voting"
                        deferred={[
                            { key: 'phaseTimerMinutes', fromPhase: 'grouping' },
                            { key: 'votesPerPerson', fromPhase: 'discussing' },
                        ]}
                    />
                </Example>
                <Example label={t('Applying (click Apply: it never resolves)')}>
                    <Stateful
                        initialDraft={{ boardLocked: true }}
                        onApply={() => new Promise<void>(() => {})}
                    />
                </Example>
                <Example label={t('Survey already added')}>
                    <Stateful attachedSurvey={t('Health check')} />
                </Example>
                <Example label={t('Read-only (participant)')}>
                    <Stateful readOnly facilitatorName="Camille R." />
                </Example>
                <Example label={t('Without survey data (no survey entry)')}>
                    <Stateful surveys={undefined} />
                </Example>
            </div>
            <Example
                label={t(
                    'Live containers: popover, side sheet (non-modal) and mobile drawer. Open the survey menu, change a value, then try to close to see the discard confirmation. Apply shows the toast.',
                )}
            >
                <div className="flex flex-wrap items-center gap-3">
                    <Live variant="popover" label={t('Open popover')} />
                    <Live variant="sheet" label={t('Open sheet')} />
                    <Live variant="drawer" label={t('Open drawer')} />
                </div>
            </Example>
        </div>
    );
}
