import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { CreateTokenForm } from '@/components/settings/api-tokens/create-token-form';
import { ServerUrl } from '@/components/settings/api-tokens/server-url';
import { TokenList } from '@/components/settings/api-tokens/token-list';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type {
    ApiToken,
    ApiTokenExpiration,
    ApiTokenExpirationOption,
    ApiTokenTeamGroup,
    NewApiToken,
} from '@/types';

type Props = {
    tokens: ApiToken[];
    teamGroups: ApiTokenTeamGroup[];
    mcpUrl: string;
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
};

export default function ApiTokens({
    tokens,
    teamGroups,
    mcpUrl,
    expirationOptions,
    defaultExpiration,
}: Props) {
    const { t } = useTrans();
    const flashedToken = usePage().flash.newToken ?? null;
    const [newToken, setNewToken] = useState<NewApiToken | null>(flashedToken);

    useEffect(() => {
        if (flashedToken !== null) {
            setNewToken(flashedToken);
        }
    }, [flashedToken]);

    return (
        <SettingsShell active="apiTokens">
            <Head title={t('API tokens')} />

            <div data-slot="api-tokens" className="flex min-w-0 flex-col gap-4">
                <CreateTokenForm
                    teamGroups={teamGroups}
                    expirationOptions={expirationOptions}
                    defaultExpiration={defaultExpiration}
                    mcpUrl={mcpUrl}
                    newToken={newToken}
                    onDone={() => setNewToken(null)}
                />
                <TokenList tokens={tokens} newTokenName={newToken?.name} />
            </div>

            <ServerUrl mcpUrl={mcpUrl} />
        </SettingsShell>
    );
}
