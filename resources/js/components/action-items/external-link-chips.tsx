import { usePage } from '@inertiajs/react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { TrackerLabels } from '@/lib/poker/types';
import type { ExternalLink } from '@/types';

type Props = {
    links: ExternalLink[] | null;
    onRetry?: (link: ExternalLink) => Promise<void>;
};

export function ExternalLinkChips({ links, onRetry }: Props) {
    if (links === null || links.length === 0) {
        return null;
    }

    return (
        <>
            {links.map((link) => (
                <ExternalLinkChip
                    key={link.source}
                    link={link}
                    onRetry={onRetry}
                />
            ))}
        </>
    );
}

function ExternalLinkChip({
    link,
    onRetry,
}: {
    link: ExternalLink;
    onRetry?: (link: ExternalLink) => Promise<void>;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [busy, setBusy] = useState(false);
    const [openedAt, setOpenedAt] = useState(0);
    const source = TrackerLabels[link.source];
    const status =
        link.statusName ?? t(link.state === 'done' ? 'Done' : 'Not done');

    const summary = (): string | null => {
        switch (link.syncState) {
            case 'off':
                return null;
            case 'synced':
                return t(':status in :source', { status, source });
            case 'pending':
                return t('Sync pending');
            case 'failed':
                return link.syncError === null
                    ? t('Sync failed')
                    : t('Sync failed: :error', { error: link.syncError });
            case 'missing':
                return t('Not found in :source', { source });
        }
    };

    const description = summary();
    const detail =
        link.syncState === 'synced' &&
        link.lastSyncedAt !== null &&
        openedAt > 0
            ? t(':status in :source · synced :time', {
                  status,
                  source,
                  time: formatRelativeTime(link.lastSyncedAt, locale, openedAt),
              })
            : description;

    const retry = async () => {
        if (!onRetry) {
            return;
        }

        setBusy(true);

        try {
            await onRetry(link);
        } finally {
            setBusy(false);
        }
    };

    const chip = (
        <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-muted"
        >
            {link.syncState !== 'off' && link.state !== null && (
                <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${
                        link.state === 'done'
                            ? 'bg-emerald-500'
                            : 'border border-muted-foreground'
                    }`}
                />
            )}
            {link.key}
            <ArrowUpRight className="size-3" aria-hidden />
            {description !== null && (
                <span className="sr-only">{description}</span>
            )}
        </a>
    );

    return (
        <span className="inline-flex items-center gap-0.5">
            {description === null ? (
                chip
            ) : (
                <Tooltip
                    onOpenChange={(open) => {
                        if (open) {
                            setOpenedAt(Date.now());
                        }
                    }}
                >
                    <TooltipTrigger asChild>{chip}</TooltipTrigger>
                    <TooltipContent>{detail}</TooltipContent>
                </Tooltip>
            )}
            {link.syncState === 'failed' && onRetry && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    disabled={busy}
                    aria-label={t('Retry the sync of :key', { key: link.key })}
                    onClick={() => void retry()}
                >
                    <RefreshCw className="size-3" />
                </Button>
            )}
        </span>
    );
}
