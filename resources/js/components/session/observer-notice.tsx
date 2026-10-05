import { Eye } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** The one line the five session screens show an observer of the team. */
export function ObserverNotice({ className }: { className?: string }) {
    const { t } = useTrans();

    return (
        <p
            role="status"
            data-slot="observer-notice"
            className={cn(
                'flex min-w-0 shrink-0 items-center justify-center gap-1.5 border-b bg-muted px-4 py-1.5 text-sm text-muted-foreground',
                className,
            )}
        >
            <Eye aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0">
                {t('You are observing this session.')}
            </span>
        </p>
    );
}
