import TeamHealthChecksController from '@/actions/App/Http/Controllers/TeamHealthChecksController';
import { HealthCheckSummary } from '@/components/skrum/health-check-summary';
import { useTrans } from '@/hooks/use-trans';
import type { TeamHealthStatement } from '@/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    statements: TeamHealthStatement[];
    canManage: boolean;
};

/**
 * The health check of a team on its page: the statements asked today, and
 * the way to the page that manages them and holds the mood trend.
 */
export function TeamHealthCard({
    workspaceSlug,
    teamId,
    statements,
    canManage,
}: Props) {
    const { t } = useTrans();

    return (
        <HealthCheckSummary
            statements={statements.filter((statement) => !statement.isArchived)}
            manageHref={TeamHealthChecksController.show({
                workspace: workspaceSlug,
                team: teamId,
            })}
            manageLabel={canManage ? t('Manage') : t('Details')}
        />
    );
}
