import { Check, CircleCheck, Copy } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type { NewApiToken } from '@/types';

type Snippet = 'claude' | 'json';

type NewTokenPanelProps = {
    token: NewApiToken;
    mcpUrl: string;
    onDone: () => void;
};

/**
 * The plain token, shown once after its creation: it takes the place of the
 * form's footer until "Done", and the token field takes the focus.
 */
export function NewTokenPanel({
    token,
    mcpUrl,
    onDone,
}: NewTokenPanelProps): ReactElement {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const [snippet, setSnippet] = useState<Snippet>('claude');
    const field = useRef<HTMLInputElement>(null);
    const noticeId = useId();

    const snippets: Record<Snippet, string> = {
        claude: `claude mcp add --transport http skrum ${mcpUrl} --header "Authorization: Bearer ${token.plainText}"`,
        json: JSON.stringify(
            {
                mcpServers: {
                    skrum: {
                        type: 'http',
                        url: mcpUrl,
                        headers: {
                            Authorization: `Bearer ${token.plainText}`,
                        },
                    },
                },
            },
            null,
            2,
        ),
    };
    const tokenCopied = copied === token.plainText;
    const snippetCopied = copied === snippets[snippet];

    useEffect(() => {
        field.current?.focus();
        field.current?.select();
    }, [token.plainText]);

    const copyText = async (text: string): Promise<void> => {
        if (!(await copy(text))) {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <div
            data-slot="new-token-panel"
            className="flex min-w-0 flex-col gap-4"
        >
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-[color-mix(in_oklch,var(--skrum-success-text)_35%,var(--border))] bg-skrum-success-soft p-4">
                <p
                    id={noticeId}
                    role="status"
                    className="flex min-w-0 items-start gap-2 text-sm font-semibold text-skrum-success-text"
                >
                    <CircleCheck
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0">
                        {t(
                            "Copy your token now. You won't be able to see it again.",
                        )}
                    </span>
                </p>
                <div className="flex min-w-0 items-center gap-2">
                    <Input
                        ref={field}
                        readOnly
                        value={token.plainText}
                        aria-label={t('API token')}
                        aria-describedby={noticeId}
                        className="min-w-0 flex-1 font-mono text-body-sm md:text-body-sm"
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => void copyText(token.plainText)}
                    >
                        {tokenCopied ? (
                            <Check aria-hidden="true" />
                        ) : (
                            <Copy aria-hidden="true" />
                        )}
                        <span>{tokenCopied ? t('Copied') : t('Copy')}</span>
                    </Button>
                </div>
            </div>

            <Tabs value={snippet} onValueChange={setSnippet} className="gap-2">
                <TabsList aria-label={t('Client configuration')}>
                    <TabsTrigger value="claude">Claude Code</TabsTrigger>
                    <TabsTrigger value="json">
                        {t('Other clients (JSON)')}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value={snippet}>
                    <pre
                        tabIndex={0}
                        role="region"
                        aria-label={t('Client configuration')}
                        className="max-h-60 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {snippets[snippet]}
                    </pre>
                </TabsContent>
            </Tabs>

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-w-full"
                    onClick={() => void copyText(snippets[snippet])}
                >
                    {snippetCopied ? (
                        <Check aria-hidden="true" />
                    ) : (
                        <Copy aria-hidden="true" />
                    )}
                    <span className="truncate">
                        {snippetCopied ? t('Copied') : t('Copy configuration')}
                    </span>
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="max-w-full"
                    onClick={onDone}
                >
                    <span className="truncate">{t('Done')}</span>
                </Button>
            </div>
        </div>
    );
}
