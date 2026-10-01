import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import IntegrationAuthorizationsController from '@/actions/App/Http/Controllers/Integrations/IntegrationAuthorizationsController';
import IntegrationTestsController from '@/actions/App/Http/Controllers/Integrations/IntegrationTestsController';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationAccess,
    IntegrationScope,
    TeamIntegration,
} from '@/types';

type ConnectLinkProps = {
    scope: IntegrationScope;
    provider: 'slack' | 'jira' | 'linear';
    label: string;
    access?: IntegrationAccess;
    variant?: 'default' | 'outline';
};

/**
 * A plain link: the server answers with a redirect to the provider's
 * consent screen, which Inertia must not follow as a visit.
 */
export function ConnectLink({
    scope,
    provider,
    label,
    access,
    variant = 'default',
}: ConnectLinkProps) {
    const href = IntegrationAuthorizationsController.create.url(
        { ...scope, provider },
        access ? { query: { access } } : undefined,
    );

    return (
        <Button variant={variant} size="sm" asChild>
            <a href={href}>{label}</a>
        </Button>
    );
}

type TestConnectionButtonProps = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    label: string;
    successMessage: string;
};

export function TestConnectionButton({
    scope,
    connection,
    label,
    successMessage,
}: TestConnectionButtonProps) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const run = async () => {
        setBusy(true);

        try {
            await retroRequest(
                IntegrationTestsController.store({
                    ...scope,
                    integration: connection.id,
                }),
            );
            toast.success(successMessage);
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
            router.reload({ only: ['providers'] });
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void run()}
        >
            {busy && <Spinner />}
            {label}
        </Button>
    );
}
