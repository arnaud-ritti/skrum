import { Check, Copy } from 'lucide-react';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';

export function ServerUrl({ mcpUrl }: { mcpUrl: string }): ReactElement {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const urlCopied = copied === mcpUrl;

    const copyUrl = async (): Promise<void> => {
        if (!(await copy(mcpUrl))) {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <SettingsCard title={t('MCP server')}>
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="mcp-url">{t('Server URL')}</Label>
                <div className="flex min-w-0 items-center gap-2">
                    <Input
                        id="mcp-url"
                        readOnly
                        value={mcpUrl}
                        aria-describedby="mcp-url-help"
                        className="min-w-0 flex-1 font-mono text-body-sm md:text-body-sm"
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => void copyUrl()}
                    >
                        {urlCopied ? (
                            <Check aria-hidden="true" />
                        ) : (
                            <Copy aria-hidden="true" />
                        )}
                        <span>{urlCopied ? t('Copied') : t('Copy')}</span>
                    </Button>
                </div>
                <span
                    id="mcp-url-help"
                    className="text-body-sm text-muted-foreground"
                >
                    {t(
                        'Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.',
                    )}
                </span>
            </div>

            <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-muted-foreground">
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
        </SettingsCard>
    );
}
