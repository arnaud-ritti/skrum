import { usePage } from '@inertiajs/react';
import { ArrowRight, Layers } from 'lucide-react';
import RetrosController from '@/actions/App/Http/Controllers/Retros/RetrosController';
import { EmptyState } from '@/components/skrum/empty-state';
import { SessionCard } from '@/components/skrum/session-card';
import type {
    SessionCardProps,
    SessionCardStatusTone,
} from '@/components/skrum/session-card';
import { TeamSection } from '@/components/teams/team-section';
import { PersonAvatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { formatAverage } from '@/lib/poker/format';
import type { RetroSummary } from '@/types';

type Props = {
    retros: RetroSummary[];
    /**
     * Place left (TM-5): participants, cards and actions of a retro, in the
     * footer of its card.
     */
    statsFor?: (retro: RetroSummary) => SessionCardProps['stats'];
};

const CompletedPhase = 'completed';

const PhaseTones: Record<string, SessionCardStatusTone> = {
    voting: 'warning',
    [CompletedPhase]: 'muted',
};

export function retroTone(phase: string): SessionCardStatusTone {
    return PhaseTones[phase] ?? 'info';
}

export function TeamRetrosSection({ retros, statsFor }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const formatDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
    });

    return (
        <TeamSection
            icon={Layers}
            title={t('Retrospectives')}
            count={retros.length}
        >
            {retros.length === 0 && (
                <Card className="border-dashed shadow-none">
                    <EmptyState
                        module="retro"
                        headingLevel="h3"
                        illustration={false}
                        title={t('No retrospectives yet.')}
                        description={t(
                            'Start one with the New session button.',
                        )}
                        className="py-6"
                    />
                </Card>
            )}
            {retros.length > 0 && (
                <ul
                    data-slot="team-retros"
                    className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3"
                >
                    {retros.map((retro) => {
                        const completed = retro.phase === CompletedPhase;

                        return (
                            <li key={retro.id} className="flex min-w-0">
                                <SessionCard
                                    className="w-full"
                                    href={RetrosController.show(retro.id)}
                                    kind="retro"
                                    title={retro.title}
                                    team={retro.templateName}
                                    when={
                                        retro.createdAt
                                            ? formatDate.format(
                                                  new Date(retro.createdAt),
                                              )
                                            : ''
                                    }
                                    status={completed ? 'ended' : 'live'}
                                    statusLabel={retro.phaseLabel}
                                    statusTone={retroTone(retro.phase)}
                                    statusDot={
                                        retroTone(retro.phase) === 'info'
                                    }
                                    stats={statsFor?.(retro)}
                                    meta={
                                        <>
                                            {retro.facilitator !== null && (
                                                <span
                                                    data-slot="retro-facilitator"
                                                    className="inline-flex min-w-0 items-center gap-1.5"
                                                >
                                                    <PersonAvatar
                                                        name={
                                                            retro.facilitator
                                                                .name
                                                        }
                                                        src={
                                                            retro.facilitator
                                                                .avatarUrl
                                                        }
                                                        size="xs"
                                                        decorative
                                                    />
                                                    <span className="truncate">
                                                        {t(
                                                            'Facilitated by :name',
                                                            {
                                                                name: retro
                                                                    .facilitator
                                                                    .name,
                                                            },
                                                        )}
                                                    </span>
                                                </span>
                                            )}
                                            {retro.rotiAverage !== null && (
                                                <span
                                                    data-slot="retro-roti"
                                                    className="whitespace-nowrap"
                                                >
                                                    {t('ROTI :score / 5', {
                                                        score: formatAverage(
                                                            retro.rotiAverage,
                                                            locale,
                                                        ),
                                                    })}
                                                </span>
                                            )}
                                            <span className="ml-auto inline-flex items-center gap-1 font-semibold whitespace-nowrap text-skrum-primary-text">
                                                {completed
                                                    ? t('Summary')
                                                    : t('Join')}
                                                <ArrowRight
                                                    aria-hidden
                                                    className="size-3.5"
                                                />
                                            </span>
                                        </>
                                    }
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </TeamSection>
    );
}
