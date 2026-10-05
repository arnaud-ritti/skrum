import { Head, Link } from '@inertiajs/react';
import { KeyRound, Plus, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import McpKeysController from '@/actions/App/Http/Controllers/Admin/McpKeysController';
import { AdminShell } from '@/components/admin/admin-shell';
import { McpKeysTable } from '@/components/admin/mcp-keys/mcp-keys-table';
import { RevokeKeyDialog } from '@/components/admin/mcp-keys/revoke-key-dialog';
import { IconEmpty } from '@/components/skrum/icon-empty';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTrans } from '@/hooks/use-trans';
import type { McpKey, McpKeysPageProps } from '@/lib/admin/types';

export default function AdminMcpKeys({
    keys,
    mcpEnabled,
    createUrl,
}: McpKeysPageProps) {
    const { t } = useTrans();
    const titleId = useId();
    const [now] = useState(() => Date.now());
    const [target, setTarget] = useState<McpKey | null>(null);
    const [revoking, setRevoking] = useState(false);

    const askToRevoke = (mcpKey: McpKey): void => {
        setTarget(mcpKey);
        setRevoking(true);
    };

    return (
        <AdminShell active="mcpKeys">
            <Head title={t('MCP keys')} />
            <section
                aria-labelledby={titleId}
                className="flex max-w-5xl min-w-0 flex-col gap-3"
            >
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
                        <h2
                            id={titleId}
                            className="min-w-0 text-xl font-title tracking-heading"
                        >
                            {t('MCP keys')}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                "To connect AI agents (Claude, IDE, scripts) to the instance's MCP server. A key is shown only once.",
                            )}
                        </p>
                    </div>
                    <Button asChild size="sm" className="max-w-full">
                        <Link href={createUrl}>
                            <Plus aria-hidden="true" />
                            <span className="truncate">
                                {t('Create a key')}
                            </span>
                        </Link>
                    </Button>
                </div>
                {!mcpEnabled && (
                    <Alert variant="warning">
                        <TriangleAlert aria-hidden="true" />
                        <span className="min-w-0">
                            {t('The MCP server is off (:env).', {
                                env: 'SKRUM_MCP_ENABLED',
                            })}
                        </span>
                    </Alert>
                )}
                <Card className="min-w-0">
                    {keys.data.length === 0 ? (
                        <IconEmpty icon={KeyRound} slot="mcp-keys-empty">
                            {t('No key yet')}
                        </IconEmpty>
                    ) : (
                        <McpKeysTable
                            keys={keys.data}
                            now={now}
                            onRevoke={askToRevoke}
                        />
                    )}
                </Card>
                {keys.last_page > 1 && (
                    <Pagination
                        page={keys.current_page}
                        pageCount={keys.last_page}
                        getHref={(page) =>
                            McpKeysController.index.url({ query: { page } })
                        }
                    />
                )}
            </section>
            <RevokeKeyDialog
                mcpKey={target}
                open={revoking}
                onOpenChange={setRevoking}
            />
        </AdminShell>
    );
}
