import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderCard,
    TeamSummary,
    TelegramBotInfo,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    providers: IntegrationProviderCard[];
    telegram: TelegramBotInfo | null;
};

export default function TeamIntegrations({ team, providers }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Integrations')} />
            <div className="max-w-2xl space-y-6 p-4">
                <Heading
                    title={t('Integrations')}
                    description={t(
                        'Connect :team to the tools it already uses.',
                        {
                            team: team.name,
                        },
                    )}
                />
                <ul className="space-y-2">
                    {providers.map((card) => (
                        <li
                            key={card.provider}
                            className="flex justify-between rounded-md border p-3 text-sm"
                        >
                            <span>{card.label}</span>
                            <span>
                                {card.connection?.statusLabel ??
                                    t('Not connected')}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
}
