import { Link } from '@inertiajs/react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type SessionCrumb = {
    label: string;
    /** Absent or null for a guest: the crumb is read, not followed. */
    href?: NavHref | null;
};

type SessionTitleProps = {
    /** Absent or null for a guest: no back link. */
    backHref?: NavHref | null;
    /** Leaving has to be asked first: the arrow is a button that calls it, not a link. */
    onBack?: () => void;
    /** The line above the title, "team · session type". It gives way below the `session-detail` step of the header. */
    overline?: ReactNode;
    /** The way to the title, "team › Whiteboards". It gives way below `md`. */
    crumbs?: SessionCrumb[];
    /** The line under the title on a phone, where the overline gives way: the phase. */
    subtitle?: ReactNode;
    /** Badges after the title (lock, deck, game). */
    badges?: ReactNode;
    children: ReactNode;
};

function Crumbs({ crumbs }: { crumbs: SessionCrumb[] }) {
    const { t } = useTrans();

    return (
        <nav
            aria-label={t('Breadcrumb')}
            data-slot="session-crumbs"
            className="hidden shrink-0 md:block"
        >
            <ol className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                {crumbs.map((crumb, index) => (
                    <li
                        key={`${index}-${crumb.label}`}
                        className="flex items-center gap-1.5"
                    >
                        {crumb.href ? (
                            <Link
                                href={crumb.href}
                                className="max-w-40 truncate rounded-sm outline-offset-2 outline-ring hover:text-foreground focus-visible:outline-2"
                            >
                                {crumb.label}
                            </Link>
                        ) : (
                            <span className="max-w-40 truncate">
                                {crumb.label}
                            </span>
                        )}
                        <ChevronRight
                            aria-hidden
                            className="size-3.5 shrink-0"
                        />
                    </li>
                ))}
            </ol>
        </nav>
    );
}

export function SessionTitle({
    backHref,
    onBack,
    overline,
    crumbs,
    subtitle,
    badges,
    children,
}: SessionTitleProps) {
    const { t } = useTrans();
    const hasCrumbs = crumbs !== undefined && crumbs.length > 0;

    return (
        <span className="flex min-w-0 items-center gap-2">
            {onBack && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('Back to the team')}
                    onClick={onBack}
                >
                    <ArrowLeft aria-hidden />
                </Button>
            )}
            {backHref && !onBack && (
                <Button asChild variant="ghost" size="icon-sm">
                    <Link href={backHref} aria-label={t('Back to the team')}>
                        <ArrowLeft aria-hidden />
                    </Link>
                </Button>
            )}
            {hasCrumbs && <Crumbs crumbs={crumbs} />}
            <span className="flex min-w-0 flex-col">
                {overline && (
                    <span
                        data-slot="session-overline"
                        className="hidden truncate text-xs font-normal text-muted-foreground @session-detail/session:block"
                    >
                        {overline}
                    </span>
                )}
                <h1
                    className={cn(
                        'min-w-0 truncate text-base font-semibold',
                        hasCrumbs && 'md:text-sm',
                    )}
                >
                    {children}
                </h1>
                {subtitle && (
                    <span
                        data-slot="session-subtitle"
                        className="text-xs font-medium break-words text-muted-foreground md:hidden"
                    >
                        {subtitle}
                    </span>
                )}
            </span>
            {badges}
        </span>
    );
}
