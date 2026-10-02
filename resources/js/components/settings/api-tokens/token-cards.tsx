import { Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { ScopeLabels } from '@/lib/api-tokens';
import type { ApiToken } from '@/types';
import type { TokenRowsProps } from './tokens-table';

function TokenCard({
    token,
    isNew,
    formatDate,
    onRevoke,
}: {
    token: ApiToken;
    isNew: boolean;
    formatDate: TokenRowsProps['formatDate'];
    onRevoke: () => void;
}): ReactElement {
    const { t } = useTrans();

    const values = [
        { label: t('Created'), value: formatDate(token.createdAt) },
        { label: t('Expires'), value: formatDate(token.expiresAt) },
        { label: t('Last used'), value: formatDate(token.lastUsedAt) },
    ];

    return (
        <li
            data-slot="token-card"
            data-done={token.isExpired ? 'true' : undefined}
            className="flex min-w-0 flex-col gap-3 border-b px-5 py-4 last:border-b-0 data-[done=true]:text-muted-foreground"
        >
            <div className="flex min-w-0 items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 text-sm font-semibold wrap-anywhere">
                            {token.name}
                        </span>
                        {isNew && (
                            <Badge variant="success" shape="pill">
                                {t('New')}
                            </Badge>
                        )}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                        skrum_…{token.hint}
                    </span>
                </div>
                <Badge variant={token.isExpired ? 'outline' : 'success'}>
                    {token.isExpired ? t('Expired') : t('Active')}
                </Badge>
            </div>

            <div className="flex flex-wrap gap-1">
                {token.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary">
                        {t(ScopeLabels[scope])}
                    </Badge>
                ))}
            </div>

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body-sm">
                <dt className="text-muted-foreground">{t('Team')}</dt>
                <dd className="min-w-0">
                    <span className="wrap-anywhere">
                        {token.team === null ? t('All teams') : token.team.name}
                    </span>
                    {!token.teamAccessible && (
                        <span className="block text-xs text-skrum-destructive-text">
                            {t('No access to this team anymore')}
                        </span>
                    )}
                </dd>
                {values.map(({ label, value }) => (
                    <div key={label} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>

            <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t('Revoke :name', { name: token.name })}
                className="max-w-full self-start text-skrum-destructive-text hover:text-skrum-destructive-text"
                onClick={onRevoke}
            >
                <Trash2 aria-hidden="true" />
                <span className="truncate">{t('Revoke')}</span>
            </Button>
        </li>
    );
}

/** The tokens of a narrow card: one block per token instead of a table row. */
export function TokenCards({
    tokens,
    formatDate,
    newTokenName,
    onRevoke,
}: TokenRowsProps): ReactElement {
    const { t } = useTrans();

    return (
        <ul aria-label={t('API tokens')} className="flex flex-col">
            {tokens.map((token) => (
                <TokenCard
                    key={token.id}
                    token={token}
                    isNew={token.name === newTokenName}
                    formatDate={formatDate}
                    onRevoke={() => onRevoke(token)}
                />
            ))}
        </ul>
    );
}
