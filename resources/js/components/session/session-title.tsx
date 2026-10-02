import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type SessionTitleProps = {
    /** Absent or null for a guest: no back link. */
    backHref?: NavHref | null;
    /** Badges after the title (lock, deck, game). */
    badges?: ReactNode;
    children: ReactNode;
};

export function SessionTitle({
    backHref,
    badges,
    children,
}: SessionTitleProps) {
    const { t } = useTrans();

    return (
        <span className="flex min-w-0 items-center gap-2">
            {backHref && (
                <Button asChild variant="ghost" size="icon-sm">
                    <Link href={backHref} aria-label={t('Back to the team')}>
                        <ArrowLeft aria-hidden />
                    </Link>
                </Button>
            )}
            <h1 className="min-w-0 truncate text-base font-semibold">
                {children}
            </h1>
            {badges}
        </span>
    );
}
