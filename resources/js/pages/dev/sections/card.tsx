import { Copy, ListChecks, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { SessionCard } from '@/components/skrum/session-card';
import type { SessionCardProps } from '@/components/skrum/session-card';
import { StatCard } from '@/components/skrum/stat-card';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({
    label,
    children,
    width,
}: {
    label: string;
    children: ReactNode;
    width?: string;
}) {
    return (
        <div className="min-w-0" style={width ? { width } : undefined}>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

export default function CardSection() {
    const { t } = useTrans();
    const href = '/dev/design-system/card';

    const ended: SessionCardProps = {
        href,
        kind: 'retro',
        title: t('Sprint 42 retrospective'),
        team: 'Atlas',
        when: t('2 days ago'),
        status: 'ended',
        stats: { participants: 9, cards: 38, actions: 6 },
    };
    const live: SessionCardProps = {
        href,
        kind: 'poker',
        title: t('Poker · Sprint 43'),
        team: 'Atlas',
        when: '10:02',
        status: 'live',
        people: [
            { name: 'Tess Martin' },
            { name: 'Noa Kim' },
            { name: 'Ana Lee' },
            { name: 'Bo Chen' },
            { name: 'Cy Dunn' },
        ],
    };

    return (
        <div className="space-y-8 p-4 md:p-6">
            <div className="grid gap-6 md:grid-cols-2">
                <State label={t('Simple card')}>
                    <Card
                        title={t('Invite the team')}
                        description={t(
                            'Share this link: guests join without an account.',
                        )}
                        footer={
                            <>
                                <Button variant="outline" size="sm">
                                    <Copy aria-hidden />
                                    {t('Copy')}
                                </Button>
                                <Button size="sm">
                                    <Mail aria-hidden />
                                    {t('Send by email')}
                                </Button>
                            </>
                        }
                    >
                        <CardContent>
                            <p className="truncate rounded-md border bg-muted px-3 py-2 text-xs">
                                skrum.app/join/atlas-7f3k
                            </p>
                        </CardContent>
                    </Card>
                </State>
                <State label={t('Simple card with action badge')}>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Jira integration')}</CardTitle>
                            <CardDescription>
                                {t('Create actions as issues.')}
                            </CardDescription>
                            <CardAction>
                                <Badge variant="secondary">
                                    {t('Connected')}
                                </Badge>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" size="sm">
                                {t('Manage')}
                            </Button>
                        </CardContent>
                    </Card>
                </State>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <State label={t('Session · rest (ended)')}>
                    <SessionCard {...ended} />
                </State>
                <State label={t('Session · live with presence')}>
                    <SessionCard {...live} />
                </State>
                <State label={t('Session · scheduled')}>
                    <SessionCard
                        {...ended}
                        kind="survey"
                        status="scheduled"
                        when={t('Tomorrow, 10:00')}
                        stats={{ participants: 6 }}
                    />
                </State>
                <State label={t('Session · whiteboard')}>
                    <SessionCard {...ended} kind="whiteboard" />
                </State>
                <State label={t('Session · icebreaker')}>
                    <SessionCard {...ended} kind="icebreaker" />
                </State>
                <State label={t('Session · long title and team name')}>
                    <SessionCard
                        {...ended}
                        title={t(
                            'Quarterly retrospective of the platform infrastructure and release engineering teams',
                        )}
                        team={t(
                            'Platform infrastructure and release engineering',
                        )}
                    />
                </State>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <State label={t('Container 11.25rem · icon and units hidden')}>
                    <div className="w-45">
                        <SessionCard {...ended} />
                    </div>
                </State>
                <State label={t('Container 15rem · badge under the title')}>
                    <div className="w-60">
                        <SessionCard {...ended} />
                    </div>
                </State>
                <State label={t('Container 21.25rem · badge on the right')}>
                    <div className="w-85">
                        <SessionCard {...ended} />
                    </div>
                </State>
                <State label={t('Container 15rem · live')}>
                    <div className="w-60">
                        <SessionCard {...live} />
                    </div>
                </State>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <State label={t('Stat · trend up, good')}>
                    <StatCard
                        label={t('Actions done · 90 days')}
                        value="73 %"
                        trend={{
                            direction: 'up',
                            label: t('8 pts'),
                            good: true,
                        }}
                        series={[52, 58, 55, 63, 66, 70, 73]}
                        context={t('Atlas, last 90 days')}
                        icon={ListChecks}
                    />
                </State>
                <State label={t('Stat · trend up, bad')}>
                    <StatCard
                        label={t('Overdue actions')}
                        value="2"
                        trend={{
                            direction: 'up',
                            label: t('1 since Monday'),
                            good: false,
                        }}
                        context={t('Atlas, this week')}
                    />
                </State>
                <State label={t('Stat · trend down, good')}>
                    <StatCard
                        label={t('Average cycle time')}
                        value="3.2 d"
                        trend={{
                            direction: 'down',
                            label: t('0.4 d'),
                            good: true,
                        }}
                        series={[4.1, 3.9, 3.8, 3.5, 3.2]}
                        context={t('Atlas, last 30 days')}
                    />
                </State>
                <State label={t('Stat · plain, 15rem container')}>
                    <div className="w-60">
                        <StatCard
                            label={t('Sessions held')}
                            value="14"
                            context={t('Atlas, last 90 days')}
                        />
                    </div>
                </State>
            </div>
        </div>
    );
}
