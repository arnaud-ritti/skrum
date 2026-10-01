import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IntegrationProviderCard } from '@/types';
import { IntegrationStatusBadge } from './integration-status-badge';

type Props = {
    icon: LucideIcon;
    card: IntegrationProviderCard;
    children?: ReactNode;
    actions?: ReactNode;
};

export function IntegrationCard({
    icon: Icon,
    card,
    children,
    actions,
}: Props) {
    const connection = card.connection;

    return (
        <Card data-test={`integration-card-${card.provider}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4" aria-hidden />
                    {card.label}
                </CardTitle>
                <IntegrationStatusBadge connection={connection} />
            </CardHeader>
            <CardContent className="space-y-4">
                {connection?.status === 'reconnect_required' &&
                    connection.lastError !== null && (
                        <p className="text-sm text-destructive">
                            {connection.lastError}
                        </p>
                    )}
                {children}
                {actions && (
                    <div className="flex flex-wrap gap-2">{actions}</div>
                )}
            </CardContent>
        </Card>
    );
}
