import { Copy, ListChecks, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
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
