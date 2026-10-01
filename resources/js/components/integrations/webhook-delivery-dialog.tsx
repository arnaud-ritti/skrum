import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type { WebhookDeliveryDetails } from '@/types';

type Props = {
    details: WebhookDeliveryDetails | null;
    failed: boolean;
    onClose: () => void;
};

type Tab = 'request' | 'response';

function prettyBody(body: string): string {
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

export function WebhookDeliveryDialog({ details, failed, onClose }: Props) {
    const { t } = useTrans();
    const [, copy] = useClipboard();
    const [tab, setTab] = useState<Tab>('request');

    const copyBody = async (body: string) => {
        if (await copy(body)) {
            toast(t('Body copied.'));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    const headers =
        details === null ? [] : Object.entries(details.request.headers);
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
                <DialogHeader>
                    <DialogTitle>{t('Delivery details')}</DialogTitle>
                    <DialogDescription>
                        {details?.event ?? ''}
                    </DialogDescription>
                </DialogHeader>
                {details === null && !failed && <Spinner />}
                {failed && (
                    <p className="text-sm text-destructive" role="alert">
                        {t('Could not load this delivery.')}
                    </p>
                )}
                {details !== null && (
                    <div className="space-y-3">
                        <div
                            className="flex gap-2"
                            role="tablist"
                            aria-label={t('Delivery details')}
                        >
                            {tabs.map((item) => (
                                <Button
                                    key={item.id}
                                    id={`delivery-tab-${item.id}`}
                                    role="tab"
                                    size="sm"
                                    variant={
                                        tab === item.id ? 'default' : 'outline'
                                    }
                                    aria-selected={tab === item.id}
                                    aria-controls="delivery-tabpanel"
                                    tabIndex={tab === item.id ? 0 : -1}
                                    onClick={() => setTab(item.id)}
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === 'ArrowRight' ||
                                            event.key === 'ArrowLeft'
                                        ) {
                                            const next =
                                                item.id === 'request'
                                                    ? 'response'
                                                    : 'request';
                                            setTab(next);
                                            document
                                                .getElementById(
                                                    `delivery-tab-${next}`,
                                                )
                                                ?.focus();
                                        }
                                    }}
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </div>
                        <div
                            id="delivery-tabpanel"
                            role="tabpanel"
                            aria-labelledby={`delivery-tab-${tab}`}
                        >
                            {tab === 'request' && headers.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    {t('Not sent yet.')}
                                </p>
                            )}
                            {tab === 'request' && headers.length > 0 && (
                                <div className="space-y-3">
                                    <table
                                        className="w-full text-left text-xs"
                                        aria-label={t('Headers')}
                                    >
                                        <tbody>
                                            {headers.map(([name, value]) => (
                                                <tr
                                                    key={name}
                                                    className="border-t"
                                                >
                                                    <th
                                                        scope="row"
                                                        className="py-1 pr-3 font-medium whitespace-nowrap"
                                                    >
                                                        {name}
                                                    </th>
                                                    <td className="py-1 break-all">
                                                        <code>{value}</code>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {details.request.body !== null && (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="text-xs font-medium">
                                                    {t('Body')}
                                                </h4>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        void copyBody(
                                                            details.request
                                                                .body ?? '',
                                                        )
                                                    }
                                                >
                                                    {t('Copy')}
                                                </Button>
                                            </div>
                                            <pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">
                                                {prettyBody(
                                                    details.request.body,
                                                )}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                            {tab === 'response' && (
                                <div className="space-y-1 text-sm">
                                    <p>
                                        {t('Status: :status', {
                                            status:
                                                details.response.status ?? '—',
                                        })}
                                    </p>
                                    {details.response.excerpt === null ? (
                                        <p className="text-muted-foreground">
                                            {t('No response body.')}
                                        </p>
                                    ) : (
                                        <pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                                            {details.response.excerpt}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
