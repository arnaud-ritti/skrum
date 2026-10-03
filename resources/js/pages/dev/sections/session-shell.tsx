import { Ellipsis, Share2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BenchSample } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { CursorToggle } from '@/components/session/cursor-preference';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionReactions } from '@/components/session/session-reactions';
import { SessionShell } from '@/components/session/session-shell';
import type {
    SessionConnection,
    SessionKind,
} from '@/components/session/session-shell';
import { SessionTimer } from '@/components/session/session-timer';
import { SessionTitle } from '@/components/session/session-title';
import { centreOrigin } from '@/components/session/use-flying-reactions';
import { ConnectionState } from '@/components/skrum/connection-state';
import { PhaseStepper } from '@/components/skrum/phase-stepper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';

export const group: BenchGroup = 'layouts';

/** A session name is written by a user: it is not translated. */
const LongTitle =
    'Sprint 42 retrospective of the Atlas team, with the platform guild and the three squads that shipped the billing migration';

/** A team name is written by a user too. */
const TeamName = 'Atlas platform and infrastructure';

const Names = [
    'Fran Facilitator',
    'Ada Lovelace',
    'Malik Diallo',
    'Yuki Tanaka',
    'Lucas Martin',
    'Sofia Rossi',
    'Noah Schmidt',
    'Chloé Dubois',
    'Mateo García',
    'Ingrid Nilsson',
    'Omar Haddad',
    'Maximilian Alexander von Hohenberg-Lichtenstein',
];

const Online: PresenceMember[] = Names.map((name, index) => ({
    id: `bench-${index + 1}`,
    name,
    avatarUrl: `/avatars/${(index + 1).toString(16).padStart(32, '0')}.svg`,
    isGuest: index > 8,
}));

const SelfId = Online[1].id;
const FacilitatorId = Online[0].id;
const TimerSeconds = 285;

const SilentChannel: WhisperChannel = {
    whisper: () => undefined,
    listen: () => undefined,
    stopListening: () => undefined,
};

const OtherKinds: SessionKind[] = ['poker', 'game', 'whiteboard'];

const noop = (): void => {};

function useOtherHints(): Record<string, string> {
    const { t } = useTrans();

    return {
        poker: t('Live updates are paused. What you see may be out of date.'),
        game: t('Live updates are paused. The round may have moved on.'),
        whiteboard: t(
            "Live updates are paused. Other people's changes appear when the connection returns.",
        ),
    };
}

function WorstCaseShell({
    connection,
    children,
}: {
    connection: SessionConnection;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const [hidden, setHidden] = useState(false);
    const [endsAt] = useState(() =>
        new Date(Date.now() + TimerSeconds * 1000).toISOString(),
    );

    const stepper = (
        <PhaseStepper
            mobile={isMobile}
            phases={[
                { id: 'icebreaker', label: t('Icebreaker') },
                { id: 'writing', label: t('Writing') },
                { id: 'grouping', label: t('Grouping') },
                { id: 'voting', label: t('Voting') },
                { id: 'discussing', label: t('Discussing') },
                { id: 'actions', label: t('Actions') },
                { id: 'roti', label: t('ROTI') },
                { id: 'completed', label: t('Completed') },
            ]}
            current="voting"
        />
    );

    /*
     * What the header holds at its worst case. From md: a title capped so
     * that the stepper keeps its room, the facilitator's timer, the stack and
     * every action. Below md the row only fits the title, a timer without
     * controls, the counter and the menu: the stepper goes under the header,
     * Share goes in the menu and the cursor toggle has no use on a phone.
     */
    return (
        <SessionShell
            kind="retro"
            realtime="connected"
            connection={connection}
            self={{ name: Online[1].name, avatarUrl: Online[1].avatarUrl }}
            title={
                <div className="max-w-28 md:max-w-48 xl:max-w-80">
                    <SessionTitle
                        backHref="/dev/design-system"
                        overline={`${TeamName} · ${t('Retrospective')}`}
                        badges={
                            <>
                                <Badge
                                    variant="outline"
                                    className="hidden shrink-0 xl:inline-flex"
                                >
                                    {t('Anonymous')}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="hidden shrink-0 xl:inline-flex"
                                >
                                    {t('Locked')}
                                </Badge>
                            </>
                        }
                    >
                        {LongTitle}
                    </SessionTitle>
                </div>
            }
            phases={isMobile ? undefined : stepper}
            timer={
                <SessionTimer
                    endsAt={endsAt}
                    offset={0}
                    totalSeconds={300}
                    onStart={isMobile ? undefined : noop}
                    onStop={isMobile ? undefined : noop}
                    onExtend={isMobile ? undefined : noop}
                    alarm={false}
                />
            }
            presence={
                <SessionPresence
                    online={Online}
                    selfId={SelfId}
                    facilitatorId={FacilitatorId}
                    className="shrink-0 flex-nowrap"
                />
            }
            actions={
                <>
                    {!isMobile && (
                        <>
                            <CursorToggle
                                hidden={hidden}
                                onChange={setHidden}
                            />
                            <Button type="button" variant="outline" size="sm">
                                <Share2 aria-hidden />
                                <span className="truncate">{t('Share')}</span>
                            </Button>
                        </>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('Menu')}
                            >
                                <Ellipsis aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isMobile && (
                                <DropdownMenuItem>
                                    <Share2 aria-hidden />
                                    {t('Share')}
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                                {t('Session settings')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            }
        >
            {isMobile ? (
                <div className="flex h-full min-h-0 flex-col">
                    <div className="border-b bg-background px-4 py-2">
                        {stepper}
                    </div>
                    <div className="relative min-h-0 flex-1">{children}</div>
                </div>
            ) : (
                children
            )}
        </SessionShell>
    );
}

function TallContent({ label }: { label: string }) {
    return (
        <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
            {Array.from({ length: 12 }, (_, index) => (
                <BenchSample key={index} label={label} />
            ))}
        </div>
    );
}

export default function SessionShellSection() {
    const { t } = useTrans();
    const hints = useOtherHints();

    return (
        <div className="flex flex-col">
            <WorstCaseShell
                connection={{ reconnecting: false, expired: false }}
            >
                <TallContent
                    label={t(
                        'Session shell, every slot filled, reaction bar over a tall content',
                    )}
                />
                <SessionReactions
                    presence={SilentChannel}
                    selfId={SelfId}
                    online={Online}
                    originFor={centreOrigin}
                    labelFor={() => null}
                />
            </WorstCaseShell>
            <WorstCaseShell connection={{ reconnecting: true, expired: false }}>
                <div className="flex flex-col gap-4 p-6">
                    <BenchSample
                        label={t(
                            'Session shell, reconnecting: the banner of a retro above, then the sentence of each other session type',
                        )}
                    />
                    {OtherKinds.map((kind) => (
                        <ConnectionState
                            key={kind}
                            status="reconnecting"
                            variant="banner"
                            hint={hints[kind]}
                        />
                    ))}
                </div>
            </WorstCaseShell>
            <WorstCaseShell connection={{ reconnecting: false, expired: true }}>
                <div className="p-6">
                    <BenchSample
                        label={t(
                            'Session shell, session expired: inert content',
                        )}
                    />
                </div>
            </WorstCaseShell>
        </div>
    );
}
