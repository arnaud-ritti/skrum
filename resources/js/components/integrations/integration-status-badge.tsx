import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { TeamIntegration } from '@/types';

type Props = {
    connection: TeamIntegration | null;
};

export function IntegrationStatusBadge({ connection }: Props) {
    const { t } = useTrans();

    if (connection === null) {
        return <Badge variant="outline">{t('Not connected')}</Badge>;
    }

    if (connection.status === 'reconnect_required') {
        return <Badge variant="destructive">{connection.statusLabel}</Badge>;
    }

    return (
        <Badge
            variant={connection.status === 'active' ? 'default' : 'secondary'}
        >
            {connection.statusLabel}
        </Badge>
    );
}
