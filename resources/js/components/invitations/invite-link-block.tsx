import { Check, Copy, Link2, Link2Off, RefreshCw } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type { InviteLink } from '@/lib/invitations/types';
import { cn } from '@/lib/utils';

const Day = 24 * 60 * 60 * 1000;

const CopiedFor = 2000;

/** Whole days left, rounded up; zero or less once the link has expired. */
export function daysUntil(expiresAt: string, now: number = Date.now()): number {
    return Math.ceil((Date.parse(expiresAt) - now) / Day);
}

function useCopied(url: string | null) {
    const { t } = useTrans();
    const [copiedText, copyText] = useClipboard({ resetMs: CopiedFor });
    const copied = copiedText !== null;

    const copy = async (): Promise<void> => {
        if (url === null) {
            return;
        }

        if (await copyText(url)) {
            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return { copied, copy };
}

/** A confirmation whose refusal stays in the dialog, with the server's reason. */
function useConfirmedAction(action: () => Promise<void>) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string>();

    const changeOpen = (next: boolean): void => {
        setError(undefined);
        setOpen(next);
    };

    const confirm = async (): Promise<void> => {
        setError(undefined);

        try {
            await action();
        } catch (failure) {
            setError(
                failure instanceof Error && failure.message !== ''
                    ? failure.message
                    : t('Something went wrong. Please try again.'),
            );

            throw failure;
        }
    };

    return { open, changeOpen, error, confirm };
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
    onTurnOff: () => Promise<void>;
    busy?: boolean;
}) {
    const { t } = useTrans();
    const labelId = useId();
    const { copied, copy } = useCopied(link?.url ?? null);
    const replacing = useConfirmedAction(onReplace);
    const turningOff = useConfirmedAction(onTurnOff);

    if (link === null && !canManage) {
        return null;
    }

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
            </div>
        );
    }

    const days = daysUntil(link.expiresAt);
    let expiry = t('Expires in :days days', { days });

    if (days <= 0) {
        expiry = t('Link expired');
    } else if (days === 1) {
        expiry = t('Expires in one day');
    }

    const joined =
        link.usesCount === 1
            ? t('1 joined')
            : t(':count joined', { count: link.usesCount });
    const help = link.usesCount > 0 ? `${expiry} · ${joined}` : expiry;
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
                    {link.url.replace(/^https?:\/\//, '')}
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
                        onClick={() => replacing.changeOpen(true)}
                    >
                        <RefreshCw aria-hidden="true" />
                        {t('Create a new link')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => turningOff.changeOpen(true)}
                        className="text-skrum-destructive-text hover:text-skrum-destructive-text"
                    >
                        <Link2Off aria-hidden="true" />
                        {t('Turn off the link')}
                    </Button>
                </div>
            )}
            <ConfirmDialog
                open={replacing.open}
                onOpenChange={replacing.changeOpen}
                error={replacing.error}
                title={t('Create a new link?')}
                description={t('The current link stops working.')}
                confirmLabel={t('Create a new link')}
                onConfirm={replacing.confirm}
            />
            <ConfirmDialog
                open={turningOff.open}
                onOpenChange={turningOff.changeOpen}
                error={turningOff.error}
                tone="destructive"
                title={t('Turn off the link?')}
                description={t('People with the link can no longer join.')}
                confirmLabel={t('Turn off the link')}
                onConfirm={turningOff.confirm}
            />
        </div>
    );
}
