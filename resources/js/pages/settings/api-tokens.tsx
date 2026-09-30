import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Heading from '@/components/heading';
import { CreateTokenDialog } from '@/components/settings/create-token-dialog';
import { NewTokenDialog } from '@/components/settings/new-token-dialog';
import { RevokeTokenDialog } from '@/components/settings/revoke-token-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type {
    ApiToken,
    ApiTokenExpiration,
    ApiTokenExpirationOption,
    ApiTokenScope,
    ApiTokenTeamGroup,
    NewApiToken,
} from '@/types';

type Props = {
    tokens: ApiToken[];
    teams: ApiTokenTeamGroup[];
    mcpUrl: string;
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
};

const ScopeLabels: Record<ApiTokenScope, string> = {
    'mcp:read': 'Read',
    'mcp:write': 'Create and update',
    'mcp:delete': 'Delete my messages',
};

export default function ApiTokens({
    tokens,
    teams,
    mcpUrl,
    expirationOptions,
    defaultExpiration,
}: Props) {
    const { t } = useTrans();
    const page = usePage();
    const { locale } = page.props;
    const flashedToken = page.flash.newToken ?? null;
    const [newToken, setNewToken] = useState<NewApiToken | null>(flashedToken);
    const [, copy] = useClipboard();
    const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string | null) =>
        value === null ? t('Never') : dateFormat.format(new Date(value));

    useEffect(() => {
        if (flashedToken !== null) {
            setNewToken(flashedToken);
        }
    }, [flashedToken]);

    const copyUrl = async () => {
        if (await copy(mcpUrl)) {
            toast(t('Link copied'));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <>
            <Head title={t('API tokens')} />

            <h1 className="sr-only">{t('API tokens')}</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('API tokens')}
                    description={t(
                        'Connect an AI assistant that supports MCP to skrum with a personal token.',
                    )}
                />

                <div className="space-y-2">
                    <label htmlFor="mcp-url" className="text-sm font-medium">
                        {t('Server URL')}
                    </label>
                    <div className="flex gap-2">
                        <Input
                            id="mcp-url"
                            readOnly
                            value={mcpUrl}
                            className="font-mono"
                            onFocus={(event) => event.currentTarget.select()}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void copyUrl()}
                        >
                            {t('Copy')}
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.',
                        )}
                    </p>
                </div>

                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>
                        {t(
                            'Data you read through this connection is sent to the AI application you use.',
                        )}
                    </li>
                    <li>
                        {t(
                            'Tokens stay valid after a password change. Revoke them here.',
                        )}
                    </li>
                </ul>

                <CreateTokenDialog
                    teams={teams}
                    expirationOptions={expirationOptions}
                    defaultExpiration={defaultExpiration}
                />

                {tokens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No API tokens yet.')}
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="p-2 font-medium">
                                        {t('Name')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Permissions')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Team')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Created')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Expires')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Last used')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Status')}
                                    </th>
                                    <th className="p-2">
                                        <span className="sr-only">
                                            {t('Revoke')}
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {tokens.map((token) => (
                                    <tr
                                        key={token.id}
                                        className={
                                            token.isExpired
                                                ? 'text-muted-foreground'
                                                : undefined
                                        }
                                    >
                                        <td className="p-2">
                                            <div className="font-medium">
                                                {token.name}
                                            </div>
                                            <div className="font-mono text-xs text-muted-foreground">
                                                skrum_…{token.hint}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-wrap gap-1">
                                                {token.scopes.map((scope) => (
                                                    <Badge
                                                        key={scope}
                                                        variant="secondary"
                                                    >
                                                        {t(ScopeLabels[scope])}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            {token.team === null
                                                ? t('All teams')
                                                : token.team.name}
                                            {!token.teamAccessible && (
                                                <div className="text-xs text-destructive">
                                                    {t(
                                                        'No access to this team anymore',
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            {formatDate(token.createdAt)}
                                        </td>
                                        <td className="p-2">
                                            {token.isExpired &&
                                            token.expiresAt !== null
                                                ? t('Expired on :date', {
                                                      date: formatDate(
                                                          token.expiresAt,
                                                      ),
                                                  })
                                                : formatDate(token.expiresAt)}
                                        </td>
                                        <td className="p-2">
                                            {formatDate(token.lastUsedAt)}
                                        </td>
                                        <td className="p-2">
                                            <Badge
                                                variant={
                                                    token.isExpired
                                                        ? 'outline'
                                                        : 'default'
                                                }
                                            >
                                                {token.isExpired
                                                    ? t('Expired')
                                                    : t('Active')}
                                            </Badge>
                                        </td>
                                        <td className="p-2 text-right">
                                            <RevokeTokenDialog token={token} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <NewTokenDialog
                token={newToken}
                mcpUrl={mcpUrl}
                onClose={() => setNewToken(null)}
            />
        </>
    );
}
