import { Hash, ListChecks, MessagesSquare, Unplug } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    ProviderCard,
    ProviderDetails,
} from '@/components/integrations/provider-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import type { TeamIntegration } from '@/types';

export const group: BenchGroup = 'skrum';

const connection: TeamIntegration = {
    id: '0199c000-0000-7000-8000-000000000001',
    provider: 'slack',
    status: 'active',
    statusLabel: 'Connected',
    access: 'write',
    settings: { teamName: 'Nordlys', channelName: '#atlas-retros' },
    connectedBy: 'Ada Admin',
    connectedAt: '2026-09-14T09:00:00+00:00',
    lastCheckedAt: '2026-09-28T16:20:00+00:00',
    lastError: null,
    webhook: null,
    statusSync: false,
    inboundMode: 'off',
    webhookStatus: null,
    lastInboundAt: null,
    lastPolledAt: null,
    inboundHint: null,
};

const formerMember: TeamIntegration = {
    ...connection,
    provider: 'msteams',
    status: 'reconnect_required',
    connectedBy: null,
    lastCheckedAt: null,
};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Disconnect() {
    const { t } = useTrans();

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-w-full text-skrum-destructive-text hover:text-skrum-destructive-text"
        >
            <Unplug aria-hidden="true" />
            <span className="truncate">{t('Disconnect')}</span>
        </Button>
    );
}

export default function SettingsIntegrationsSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t(
                    'Provider card: not connected, connected, setup required, reconnect required',
                )}
            >
                <Card className="max-w-200 min-w-0 divide-y">
                    <ProviderCard
                        provider={{
                            key: 'telegram',
                            label: 'Telegram',
                            icon: MessagesSquare,
                        }}
                        status={{ label: t('Not connected'), tone: 'none' }}
                        actions={
                            <Button type="button" size="sm">
                                <span className="truncate">{t('Connect')}</span>
                            </Button>
                        }
                    />
                    <ProviderCard
                        provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                        status={{ label: t('Connected'), tone: 'active' }}
                        summary="Nordlys · #atlas-retros"
                        details={
                            <ProviderDetails
                                rows={[
                                    {
                                        label: t('Workspace'),
                                        value: 'Nordlys',
                                    },
                                    {
                                        label: t('Channel'),
                                        value: '#atlas-retros',
                                    },
                                ]}
                                connection={connection}
                            />
                        }
                        actions={
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                >
                                    <span className="truncate">
                                        {t('Send a test message')}
                                    </span>
                                </Button>
                                <Disconnect />
                            </>
                        }
                    />
                    <ProviderCard
                        provider={{
                            key: 'jira',
                            label: 'Jira',
                            icon: ListChecks,
                        }}
                        status={{ label: t('Setup required'), tone: 'setup' }}
                        actions={<Disconnect />}
                    >
                        <p className="text-sm">
                            {t('Choose the Jira site this team uses:')}
                        </p>
                    </ProviderCard>
                    <ProviderCard
                        provider={{
                            key: 'msteams',
                            label: 'Microsoft Teams, with a long provider name that is shortened',
                            icon: MessagesSquare,
                        }}
                        status={{
                            label: t('Reconnect required'),
                            tone: 'reconnect',
                        }}
                        error="The workflow answered 404. Paste the URL of the workflow again."
                        details={
                            <ProviderDetails
                                rows={[
                                    {
                                        label: t('Channel'),
                                        value: 'A channel label of eighty characters, the longest one the form accepts, wraps',
                                    },
                                ]}
                                connection={formerMember}
                            />
                        }
                        actions={
                            <>
                                <Button type="button" size="sm">
                                    <span className="truncate">
                                        {t('Reconnect')}
                                    </span>
                                </Button>
                                <Disconnect />
                            </>
                        }
                    />
                </Card>
            </Example>
        </div>
    );
}
