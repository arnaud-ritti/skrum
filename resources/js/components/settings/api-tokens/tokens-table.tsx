import { Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';
import { ScopeLabels } from '@/lib/api-tokens';
import type { TokenDateFormatter } from '@/lib/api-tokens';
import type { ApiToken } from '@/types';

export type TokenRowsProps = {
    tokens: ApiToken[];
    formatDate: TokenDateFormatter;
    /** Name of the token shown once above: its row is marked "New". */
    newTokenName?: string;
    onRevoke: (token: ApiToken) => void;
};

const head = 'px-2 whitespace-normal';
const cell = 'px-2 text-body-sm';
const date = `${cell} tabular-nums`;

/**
 * The eight columns and their order are read by the walkthrough of the page
 * (`ApiTokensTest`): scopes second, team third, expiry fifth, last use
 * sixth.
 */
export function TokensTable({
    tokens,
    formatDate,
    newTokenName,
    onRevoke,
}: TokenRowsProps): ReactElement {
    const { t } = useTrans();

    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${head} pl-5`}>
                        {t('Name')}
                    </TableHead>
                    <TableHead className={head}>{t('Scopes')}</TableHead>
                    <TableHead className={head}>{t('Team')}</TableHead>
                    <TableHead className={head}>{t('Created')}</TableHead>
                    <TableHead className={head}>{t('Expires')}</TableHead>
                    <TableHead className={head}>{t('Last used')}</TableHead>
                    <TableHead className={head}>{t('Status')}</TableHead>
                    <TableHead className={`${head} pr-5`}>
                        <span className="sr-only">{t('Actions')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tokens.map((token) => (
                    <TableRow
                        key={token.id}
                        done={token.isExpired}
                        className="hover:bg-transparent"
                    >
                        <TableCell className={`${cell} pl-5`}>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-semibold wrap-anywhere">
                                    {token.name}
                                </span>
                                {token.name === newTokenName && (
                                    <Badge variant="success" shape="pill">
                                        {t('New')}
                                    </Badge>
                                )}
                            </span>
                            <span className="block font-mono text-xs whitespace-nowrap text-muted-foreground">
                                skrum_…{token.hint}
                            </span>
                        </TableCell>
                        <TableCell className={cell}>
                            <span className="flex flex-col items-start gap-1">
                                {token.scopes.map((scope) => (
                                    <Badge key={scope} variant="secondary">
                                        {t(ScopeLabels[scope])}
                                    </Badge>
                                ))}
                            </span>
                        </TableCell>
                        <TableCell className={cell}>
                            <span className="wrap-anywhere">
                                {token.team === null
                                    ? t('All teams')
                                    : token.team.name}
                            </span>
                            {!token.teamAccessible && (
                                <span className="block text-xs text-skrum-destructive-text">
                                    {t('No access to this team anymore')}
                                </span>
                            )}
                        </TableCell>
                        <TableCell className={date}>
                            {formatDate(token.createdAt)}
                        </TableCell>
                        <TableCell className={date}>
                            {formatDate(token.expiresAt)}
                        </TableCell>
                        <TableCell className={date}>
                            {formatDate(token.lastUsedAt)}
                        </TableCell>
                        <TableCell className={cell}>
                            <Badge
                                variant={
                                    token.isExpired ? 'outline' : 'success'
                                }
                            >
                                {token.isExpired ? t('Expired') : t('Active')}
                            </Badge>
                        </TableCell>
                        <TableCell className={`${cell} pr-5 text-right`}>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={t('Revoke :name', {
                                    name: token.name,
                                })}
                                className="-mr-2 text-skrum-destructive-text hover:text-skrum-destructive-text"
                                onClick={() => onRevoke(token)}
                            >
                                <Trash2 aria-hidden="true" />
                                <span>{t('Revoke')}</span>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
