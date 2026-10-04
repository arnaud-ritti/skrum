import { Check, CircleAlert, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type { WebhookDeliveryDetails } from '@/types';

type Props = {
    label: string;
    details: WebhookDeliveryDetails | null;
    failed: boolean;
    onClose: () => void;
    onRetry: () => void;
};

type Tab = 'request' | 'response';

const PanelId = 'delivery-tabpanel';

function prettyBody(body: string): string {
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

/**
 * What was sent and what came back. The ids of the two tabs and of their one
 * panel are fixed: the browser suite finds them by id.
 */
export function WebhookDeliveryDialog({
    label,
    details,
    failed,
    onClose,
    onRetry,
}: Props) {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const [tab, setTab] = useState<Tab>('request');

    const copyBody = async (body: string) => {
        if (!(await copy(body))) {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    const headers =
        details === null ? [] : Object.entries(details.request.headers);
    const body = details?.request.body ?? null;
    const nothingSent = headers.length === 0 && body === null;
    const tabs: { id: Tab; label: string }[] = [
        { id: 'request', label: t('Request') },
        { id: 'response', label: t('Response') },
    ];

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader className="pr-8">
                    <DialogTitle>{t('Delivery details')}</DialogTitle>
                    <DialogDescription className="font-mono text-xs break-all">
                        {details?.event ?? label}
                    </DialogDescription>
                </DialogHeader>
                {details === null && !failed && (
                    <div
                        role="status"
                        data-slot="delivery-loading"
                        className="flex flex-col gap-2"
                    >
                        <span className="sr-only">{t('Loading…')}</span>
                        <Skeleton className="h-9 w-48" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                )}
                {failed && (
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                        <p
                            role="alert"
                            className="flex min-w-0 flex-1 basis-40 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                        >
                            <CircleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0"
                            />
                            <span className="min-w-0">
                                {t('Could not load this delivery.')}
                            </span>
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="max-w-full"
                            onClick={onRetry}
                        >
                            <span className="truncate">{t('Retry')}</span>
                        </Button>
                    </div>
                )}
                {details !== null && (
                    <Tabs
                        value={tab}
                        onValueChange={setTab}
                        className="min-w-0 gap-3"
                    >
                        <TabsList aria-label={t('Delivery details')}>
                            {tabs.map((item) => (
                                <TabsTrigger
                                    key={item.id}
                                    value={item.id}
                                    id={`delivery-tab-${item.id}`}
                                    aria-controls={PanelId}
                                >
                                    {item.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <TabsContent
                            value={tab}
                            id={PanelId}
                            aria-labelledby={`delivery-tab-${tab}`}
                            className="min-w-0"
                        >
                            {tab === 'request' && nothingSent && (
                                <p className="text-sm text-muted-foreground">
                                    {t('Not sent yet.')}
                                </p>
                            )}
                            {tab === 'request' && !nothingSent && (
                                <div className="flex min-w-0 flex-col gap-4">
                                    {headers.length > 0 && (
                                        <div className="overflow-hidden rounded-lg border">
                                            <table
                                                aria-label={t('Headers')}
                                                className="w-full text-left text-xs"
                                            >
                                                <tbody className="divide-y">
                                                    {headers.map(
                                                        ([name, value]) => (
                                                            <tr key={name}>
                                                                <th
                                                                    scope="row"
                                                                    className="w-px px-3 py-2 align-top font-semibold whitespace-nowrap text-muted-foreground"
                                                                >
                                                                    {name}
                                                                </th>
                                                                <td className="px-3 py-2 align-top break-all">
                                                                    <code className="font-mono">
                                                                        {value}
                                                                    </code>
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {body !== null && (
                                        <div className="flex min-w-0 flex-col gap-2">
                                            <div className="flex min-w-0 items-center justify-between gap-2">
                                                <h3 className="text-sm font-semibold">
                                                    {t('Body')}
                                                </h3>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        void copyBody(body)
                                                    }
                                                >
                                                    {copied === body ? (
                                                        <Check aria-hidden="true" />
                                                    ) : (
                                                        <Copy aria-hidden="true" />
                                                    )}
                                                    <span>
                                                        {copied === body
                                                            ? t('Copied')
                                                            : t('Copy')}
                                                    </span>
                                                </Button>
                                            </div>
                                            <pre
                                                tabIndex={0}
                                                role="region"
                                                aria-label={t('Body')}
                                                className="max-h-80 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                {prettyBody(body)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                            {tab === 'response' && (
                                <div className="flex min-w-0 flex-col gap-3">
                                    <p className="text-sm">
                                        <Badge
                                            asChild
                                            variant={
                                                details.response.status === null
                                                    ? 'muted'
                                                    : details.response.status <
                                                        400
                                                      ? 'success'
                                                      : 'destructive'
                                            }
                                        >
                                            <span className="tabular-nums">
                                                {t('Status: :status', {
                                                    status:
                                                        details.response
                                                            .status ?? '—',
                                                })}
                                            </span>
                                        </Badge>
                                    </p>
                                    {details.response.excerpt === null ? (
                                        <p className="text-sm text-muted-foreground">
                                            {t('No response body.')}
                                        </p>
                                    ) : (
                                        <pre
                                            tabIndex={0}
                                            role="region"
                                            aria-label={t('Response')}
                                            className="max-h-80 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {details.response.excerpt}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}
