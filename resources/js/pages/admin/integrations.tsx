import { Head } from '@inertiajs/react';
import { useId } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { useFreshConfirmation } from '@/components/admin/configuration/confirmation-line';
import { IntegrationRow } from '@/components/admin/integrations/integration-row';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationSettingsPageProps } from '@/lib/admin/types';

export default function AdminIntegrations({
    providers,
    disabled,
    confirmedUntil,
    confirmUrl,
}: IntegrationSettingsPageProps) {
    const { t } = useTrans();
    const titleId = useId();
    const { needsConfirmation, refuse } = useFreshConfirmation(confirmedUntil);

    return (
        <AdminShell active="integrations">
            <Head title={t('Integrations')} />
            <section
                aria-labelledby={titleId}
                className="flex max-w-3xl min-w-0 flex-col gap-3"
            >
                <h2
                    id={titleId}
                    className="min-w-0 text-xl font-title tracking-heading"
                >
                    {t('Integrations')}
                </h2>
                <Card>
                    <div className="flex min-w-0 flex-col p-5">
                        {providers.map((provider) => (
                            <IntegrationRow
                                key={provider.key}
                                provider={provider}
                                disabled={disabled}
                                needsConfirmation={needsConfirmation}
                                confirmUrl={confirmUrl}
                                onConfirmationRefused={refuse}
                            />
                        ))}
                    </div>
                </Card>
            </section>
        </AdminShell>
    );
}
