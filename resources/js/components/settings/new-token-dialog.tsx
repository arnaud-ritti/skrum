import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type { NewApiToken } from '@/types';

type Snippet = 'claude' | 'json';

type Props = {
    token: NewApiToken | null;
    mcpUrl: string;
    onClose: () => void;
};

export function NewTokenDialog({ token, mcpUrl, onClose }: Props) {
    const { t } = useTrans();
    const [, copy] = useClipboard();
    const [snippet, setSnippet] = useState<Snippet>('claude');

    if (token === null) {
        return null;
    }

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

    const copyText = async (text: string, message: string) => {
        if (await copy(text)) {
            toast(message);

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent
                className="sm:max-w-2xl"
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <DialogTitle>{token.name}</DialogTitle>
                <DialogDescription>
                    {t(
                        "Copy your token now. You won't be able to see it again.",
                    )}
                </DialogDescription>

                <div className="flex gap-2">
                    <Input
                        readOnly
                        value={token.plainText}
                        aria-label={t('API token')}
                        className="font-mono"
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            void copyText(token.plainText, t('Token copied'))
                        }
                    >
                        {t('Copy')}
                    </Button>
                </div>

                <div className="space-y-2">
                    <div
                        role="tablist"
                        aria-label={t('Client configuration')}
                        className="flex gap-2"
                    >
                        <Button
                            type="button"
                            role="tab"
                            size="sm"
                            variant={
                                snippet === 'claude' ? 'default' : 'outline'
                            }
                            aria-selected={snippet === 'claude'}
                            onClick={() => setSnippet('claude')}
                        >
                            Claude Code
                        </Button>
                        <Button
                            type="button"
                            role="tab"
                            size="sm"
                            variant={snippet === 'json' ? 'default' : 'outline'}
                            aria-selected={snippet === 'json'}
                            onClick={() => setSnippet('json')}
                        >
                            {t('Other clients (JSON)')}
                        </Button>
                    </div>
                    <pre
                        role="tabpanel"
                        className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs break-all whitespace-pre-wrap"
                    >
                        {snippets[snippet]}
                    </pre>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            void copyText(snippets[snippet], t('Copied'))
                        }
                    >
                        {t('Copy configuration')}
                    </Button>
                </div>

                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        {t('Done')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
