import { Link, usePage } from '@inertiajs/react';
import { AlarmClock } from 'lucide-react';
import { useId } from 'react';
import { toActionItemData } from '@/components/action-items/action-item-adapters';
import { ActionItem } from '@/components/skrum/action-item';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem as ActionItemRow } from '@/lib/retro/types';

type Props = {
    /** The first open items of the team, overdue first. */
    items: ActionItemRow[];
    count: number;
    overdueCount: number;
    /** Who may create an item sees the card even while the team has none. */
    canCreate: boolean;
    /** The action items page filtered on the team. */
    seeAllHref: string;
};

/** The card only shows the items: they are changed on the action items page. */
const Reader: ActionItemViewer = {
    userId: null,
    participantId: null,
    isWorkspaceManager: false,
    facilitatedRetroIds: [],
    reviewTeamIds: [],
};

/** The open action items gathered from every session of the team (ScreenDashboard). */
export function TeamOpenActionsCard({
    items,
    count,
    overdueCount,
    canCreate,
    seeAllHref,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const headingId = useId();

    if (count === 0 && !canCreate) {
        return null;
    }

    return (
        <Card asChild>
            <section
                id="open-actions"
                aria-labelledby={headingId}
                className="scroll-mt-20"
            >
                <CardHeader>
                    <h2
                        id={headingId}
                        className="flex min-w-0 items-center gap-2 text-base leading-snug font-title"
                    >
                        <span className="truncate">
                            {t('Open action items')}
                        </span>
                        <Badge variant="muted" shape="pill">
                            {count}
                        </Badge>
                    </h2>
                    <CardDescription>
                        {t(
                            'Gathered from every session of the team · overdue first.',
                        )}
                    </CardDescription>
                    <CardAction className="flex flex-wrap items-center justify-end gap-2">
                        {overdueCount > 0 && (
                            <Badge
                                data-slot="open-actions-overdue"
                                variant="destructive"
                                shape="pill"
                            >
                                <AlarmClock aria-hidden />
                                {t(':count overdue', { count: overdueCount })}
                            </Badge>
                        )}
                        <Button
                            variant="link"
                            size="sm"
                            className="px-0"
                            asChild
                        >
                            <Link href={seeAllHref}>{t('See all')}</Link>
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No open action items.')}
                        </p>
                    ) : (
                        <div role="list" className="flex flex-col gap-2">
                            {items.map((item) => {
                                const data = toActionItemData(item, {
                                    locale,
                                    viewer: Reader,
                                });

                                return (
                                    <ActionItem
                                        key={item.id}
                                        data-test="open-action"
                                        {...data}
                                        canComplete={false}
                                        compact
                                    />
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </section>
        </Card>
    );
}
