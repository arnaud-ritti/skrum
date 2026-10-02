import {
    CalendarClock,
    Check,
    Crown,
    TriangleAlert,
    UserRound,
    VenetianMask,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

export default function BadgeSection() {
    const { t } = useTrans();

    return (
        <div className="flex max-w-240 flex-col gap-6 p-6">
            <State label={t('Variants')}>
                <Badge>{t('Default')}</Badge>
                <Badge variant="secondary">{t('Secondary')}</Badge>
                <Badge variant="outline">{t('Outline')}</Badge>
                <Badge variant="muted">{t('Muted')}</Badge>
                <Badge variant="soft">{t('Soft')}</Badge>
                <Badge variant="success">{t('Success')}</Badge>
                <Badge variant="warning">{t('Warning')}</Badge>
                <Badge variant="info">{t('Info')}</Badge>
                <Badge variant="destructive">{t('Destructive')}</Badge>
            </State>
            <State label={t('Pill shape')}>
                <Badge shape="pill">{t('Default')}</Badge>
                <Badge shape="pill" variant="soft">
                    {t('Soft')}
                </Badge>
                <Badge shape="pill" variant="outline">
                    {t('Outline')}
                </Badge>
            </State>
            <State label={t('Roles with icon')}>
                <Badge variant="soft" icon={Crown}>
                    {t('Facilitator')}
                </Badge>
                <Badge variant="outline" icon={UserRound}>
                    {t('Guest')}
                </Badge>
                <Badge variant="muted" icon={VenetianMask}>
                    {t('Anonymous')}
                </Badge>
            </State>
            <State label={t('Statuses with icon')}>
                <Badge variant="success" icon={Check}>
                    {t('Consensus')}
                </Badge>
                <Badge variant="destructive" icon={CalendarClock}>
                    {t('Overdue')}
                </Badge>
                <Badge variant="warning" icon={TriangleAlert}>
                    {t('Vote gap')}
                </Badge>
            </State>
            <State label={t('With dot')}>
                <Badge variant="success" dot="var(--skrum-success)">
                    {t('Live')}
                </Badge>
                <Badge variant="outline" shape="pill" dot="var(--skrum-info)">
                    {t('Draft')}
                </Badge>
            </State>
            <State label={t('Counter with aria-label')}>
                <Badge
                    variant="secondary"
                    aria-label={t(':count open actions', { count: 6 })}
                >
                    6
                </Badge>
            </State>
            <State label={t('As link (hover and focus)')}>
                <Badge asChild variant="outline">
                    <a href="#badge">{t('Open team')}</a>
                </Badge>
                <Badge asChild variant="soft" icon={Crown}>
                    <a href="#badge">{t('Facilitator')}</a>
                </Badge>
            </State>
            <State label={t('Long label, narrow container')}>
                <div className="w-40">
                    <Badge variant="info" className="max-w-full">
                        <span className="truncate">
                            {t('A very long status label that must truncate')}
                        </span>
                    </Badge>
                </div>
            </State>
            <State
                label={t('Wrapping label: the caller opts in, the badge grows')}
            >
                <div className="w-40">
                    <Badge variant="outline" className="whitespace-normal">
                        {t(
                            'Not synced: the remote tracker refused the request',
                        )}
                    </Badge>
                </div>
            </State>
        </div>
    );
}
