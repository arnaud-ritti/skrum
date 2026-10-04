import { Check, Copy, Link2, Link2Off, RefreshCw } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { InviteLink } from '@/lib/invitations/types';
import { cn } from '@/lib/utils';

const Day = 24 * 60 * 60 * 1000;

const CopiedFor = 2000;

export function daysUntil(expiresAt: string, now: number = Date.now()): number {
    return Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / Day));
}

function useCopied(url: string | null) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timer = window.setTimeout(() => setCopied(false), CopiedFor);

        return () => window.clearTimeout(timer);
    }, [copied]);

    const copy = async (): Promise<void> => {
        if (url === null || !navigator.clipboard) {
            return;
        }

        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return { copied, copy };
}

/**
 * "Or share this link": the team's invite link, its expiry and how many
 * joined through it (decision 3 C: no use limit), and for the team's
 * inviters "Create a new link" and "Turn off the link".
 */
export function InviteLinkBlock({
    link,
    canManage,
    onCreate,
    onReplace,
    onTurnOff,
    busy = false,
}: {
    link: InviteLink | null;
    canManage: boolean;
    onCreate: () => void;
    onReplace: () => Promise<void>;
    onTurnOff: () => void;
    busy?: boolean;
}) {
    const { t } = useTrans();
    const labelId = useId();
    const { copied, copy } = useCopied(link?.url ?? null);
    const [confirming, setConfirming] = useState(false);

    if (link === null) {
        return (
            <div
                data-slot="invite-link-block"
                role="group"
                aria-labelledby={labelId}
                className="flex min-w-0 flex-col gap-1.5"
            >
                <span id={labelId} className="text-sm font-medium">
                    {t('Or share this link')}
                </span>
                {canManage && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={onCreate}
                        className="self-start"
                    >
                        <Link2 aria-hidden="true" />
                        {t('Create a link')}
                    </Button>
                )}
            </div>
        );
    }

    const days = daysUntil(link.expiresAt);
    const expiry =
        days === 1
            ? t('Expires in one day')
            : t('Expires in :days days', { days });
    const help =
        link.usesCount > 0
            ? `${expiry} · ${t(':count joined', { count: link.usesCount })}`
            : expiry;
    const CopyIcon = copied ? Check : Copy;

    return (
        <div
            data-slot="invite-link-block"
            role="group"
            aria-labelledby={labelId}
            className="flex min-w-0 flex-col gap-1.5"
        >
            <span id={labelId} className="text-sm font-medium">
                {t('Or share this link')}
            </span>
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-muted py-1 pr-1 pl-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                    {link.url}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copy()}
                    data-copied={copied}
                    className={cn(
                        'shrink-0',
                        copied &&
                            'border-skrum-success-text/35 bg-skrum-success-soft text-skrum-success-text hover:bg-skrum-success-soft hover:text-skrum-success-text',
                    )}
                >
                    <CopyIcon aria-hidden="true" />
                    <span aria-live="polite">
                        {copied ? t('Copied') : t('Copy')}
                    </span>
                </Button>
            </div>
            <span className="text-body-sm text-muted-foreground">{help}</span>
            {canManage && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirming(true)}
                    >
                        <RefreshCw aria-hidden="true" />
                        {t('Create a new link')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={onTurnOff}
                        className="text-skrum-destructive-text hover:text-skrum-destructive-text"
                    >
                        <Link2Off aria-hidden="true" />
                        {t('Turn off the link')}
                    </Button>
                </div>
            )}
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={t('Create a new link?')}
                description={t('The current link stops working.')}
                confirmLabel={t('Create a new link')}
                onConfirm={onReplace}
            />
        </div>
    );
}
