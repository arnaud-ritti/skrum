import { usePage } from '@inertiajs/react';
import type { ReactElement } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
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
import { formatRelativeTime, formatShortDate } from '@/lib/action-items/format';
import type { McpKey } from '@/lib/admin/types';

export type McpKeysTableProps = {
    keys: McpKey[];
    /** The moment "last used" is counted from. */
    now: number;
    onRevoke: (key: McpKey) => void;
};

const head = 'px-2 whitespace-normal';
const cell = 'px-2 text-body-sm';
const date = `${cell} tabular-nums`;
const revokeClass =
    'text-skrum-destructive-text hover:text-skrum-destructive-text';

function useKeyFormat(now: number) {
    const { t } = useTrans();
    const { locale } = usePage<{ locale: string }>().props;

    return {
        created: (key: McpKey): string =>
            key.createdAt === null
                ? key.owner.name
                : `${formatShortDate(key.createdAt, locale)} · ${key.owner.name}`,
        lastUsed: (key: McpKey): string =>
            key.lastUsedAt === null
                ? t('Never')
                : formatRelativeTime(key.lastUsedAt, locale, now),
        expires: (key: McpKey): string =>
            key.expiresAt === null
                ? t('Never')
                : formatShortDate(key.expiresAt, locale),
        team: (key: McpKey): string => key.team ?? t('All teams'),
    };
}

function Scopes({ scopes }: { scopes: string[] }): ReactElement {
    return (
        <span className="flex flex-wrap gap-1">
            {scopes.map((scope) => (
                <code
                    key={scope}
                    className="rounded-xs border bg-muted px-1.5 font-mono text-xs leading-5 font-medium whitespace-nowrap"
                >
                    {scope}
                </code>
            ))}
        </span>
    );
}

function KeyName({ mcpKey }: { mcpKey: McpKey }): ReactElement {
    return (
        <>
            <span className="block text-sm font-semibold wrap-anywhere">
                {mcpKey.name}
            </span>
            <span className="block font-mono text-xs whitespace-nowrap text-muted-foreground">
                {mcpKey.fingerprint}
            </span>
        </>
    );
}

function Created({
    mcpKey,
    label,
}: {
    mcpKey: McpKey;
    label: string;
}): ReactElement {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <PersonAvatar
                decorative
                name={mcpKey.owner.name}
                src={mcpKey.owner.avatarUrl}
                size="xs"
                className="shrink-0"
            />
            <span className="min-w-0 wrap-anywhere">{label}</span>
        </span>
    );
}

/**
 * Every key of the instance. Both layouts are in the page: the table from a
 * wide container, stacked cards below it (the mockup's mobile rule).
 */
export function McpKeysTable({
    keys,
    now,
    onRevoke,
}: McpKeysTableProps): ReactElement {
    const { t } = useTrans();
    const format = useKeyFormat(now);

    return (
        <div className="@container/keys min-w-0">
            <div data-slot="mcp-keys-table" className="hidden @3xl/keys:block">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={`${head} pl-5`}>
                                {t('Name')}
                            </TableHead>
                            <TableHead className={head}>
                                {t('Scopes')}
                            </TableHead>
                            <TableHead className={head}>{t('Team')}</TableHead>
                            <TableHead className={head}>
                                {t('Created')}
                            </TableHead>
                            <TableHead className={head}>
                                {t('Last used')}
                            </TableHead>
                            <TableHead className={head}>
                                {t('Expires')}
                            </TableHead>
                            <TableHead className={`${head} pr-5`}>
                                <span className="sr-only">{t('Actions')}</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {keys.map((mcpKey) => (
                            <TableRow
                                key={mcpKey.id}
                                className="hover:bg-transparent"
                            >
                                <TableCell className={`${cell} pl-5`}>
                                    <KeyName mcpKey={mcpKey} />
                                </TableCell>
                                <TableCell className={cell}>
                                    <Scopes scopes={mcpKey.scopes} />
                                </TableCell>
                                <TableCell className={cell}>
                                    <span className="wrap-anywhere">
                                        {format.team(mcpKey)}
                                    </span>
                                </TableCell>
                                <TableCell className={date}>
                                    <Created
                                        mcpKey={mcpKey}
                                        label={format.created(mcpKey)}
                                    />
                                </TableCell>
                                <TableCell
                                    className={
                                        mcpKey.lastUsedAt === null
                                            ? `${date} text-muted-foreground`
                                            : date
                                    }
                                >
                                    {format.lastUsed(mcpKey)}
                                </TableCell>
                                <TableCell className={date}>
                                    {format.expires(mcpKey)}
                                </TableCell>
                                <TableCell
                                    className={`${cell} pr-5 text-right`}
                                >
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label={t('Revoke :name', {
                                            name: mcpKey.name,
                                        })}
                                        className={`-mr-2 ${revokeClass}`}
                                        onClick={() => onRevoke(mcpKey)}
                                    >
                                        {t('Revoke')}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <ul
                data-slot="mcp-keys-cards"
                aria-label={t('MCP keys')}
                className="flex flex-col @3xl/keys:hidden"
            >
                {keys.map((mcpKey) => (
                    <li
                        key={mcpKey.id}
                        className="flex min-w-0 flex-col gap-3 border-b px-5 py-4 last:border-b-0"
                    >
                        <div className="min-w-0">
                            <KeyName mcpKey={mcpKey} />
                        </div>
                        <Scopes scopes={mcpKey.scopes} />
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body-sm">
                            <dt className="text-muted-foreground">
                                {t('Team')}
                            </dt>
                            <dd className="min-w-0 wrap-anywhere">
                                {format.team(mcpKey)}
                            </dd>
                            <dt className="text-muted-foreground">
                                {t('Created')}
                            </dt>
                            <dd className="min-w-0 tabular-nums">
                                <Created
                                    mcpKey={mcpKey}
                                    label={format.created(mcpKey)}
                                />
                            </dd>
                            <dt className="text-muted-foreground">
                                {t('Last used')}
                            </dt>
                            <dd className="min-w-0 tabular-nums">
                                {format.lastUsed(mcpKey)}
                            </dd>
                            <dt className="text-muted-foreground">
                                {t('Expires')}
                            </dt>
                            <dd className="min-w-0 tabular-nums">
                                {format.expires(mcpKey)}
                            </dd>
                        </dl>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={t('Revoke :name', {
                                name: mcpKey.name,
                            })}
                            className={`max-w-full self-start ${revokeClass}`}
                            onClick={() => onRevoke(mcpKey)}
                        >
                            <span className="truncate">{t('Revoke')}</span>
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
