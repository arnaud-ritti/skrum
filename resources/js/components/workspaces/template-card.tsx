import { Link } from '@inertiajs/react';
import { Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardMenu } from '@/components/ui/dropdown-menu';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { TemplateAuthor, TemplateColumn } from '@/types';

export const TemplateGridClass =
    'grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(66)),1fr))] gap-4';

export type TemplateCardProps = {
    name: string;
    /** The line under the name: "4 columns · used 12×", the usage of a deck. */
    meta?: string;
    preview: ReactNode;
    previewClassName?: string;
    author?: TemplateAuthor | null;
    /** Where "Use" leads; `null` without a team: the button stays, inert, with its hint. */
    useHref: string | null;
    /** Entries of the "…" menu; no menu without entries. */
    menu?: MenuEntry[];
    /** WS-2: the visibility badge of a template, beside its name. */
    badge?: ReactNode;
    'data-test'?: string;
    className?: string;
};

/** One card of the templates page: preview, name, facts, author and "Use". */
export function TemplateCard({
    name,
    meta,
    preview,
    previewClassName,
    author,
    useHref,
    menu = [],
    badge,
    'data-test': dataTest,
    className,
}: TemplateCardProps) {
    const { t } = useTrans();
    const titleId = useId();
    const hintId = useId();
    const useLabel = t('Use :name', { name });

    return (
        <Card
            asChild
            data-slot="template-card"
            data-test={dataTest}
            className={cn('h-full min-w-0 overflow-hidden', className)}
        >
            <article aria-labelledby={titleId}>
                <div
                    data-slot="template-card-preview"
                    className={cn(
                        'flex min-h-26 border-b bg-skrum-canvas p-3',
                        previewClassName,
                    )}
                >
                    {preview}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                            <h3
                                id={titleId}
                                className="truncate text-sm font-semibold"
                            >
                                {name}
                            </h3>
                            {meta !== undefined && (
                                <p
                                    data-slot="template-card-meta"
                                    className="text-xs wrap-anywhere text-muted-foreground"
                                >
                                    {meta}
                                </p>
                            )}
                        </div>
                        {(badge !== undefined || menu.length > 0) && (
                            <div className="flex shrink-0 items-center gap-1">
                                {badge}
                                {menu.length > 0 && (
                                    <CardMenu
                                        label={t('Actions for :name', { name })}
                                        entries={menu}
                                        trigger={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                data-slot="template-card-menu"
                                                aria-label={t(
                                                    'Actions for :name',
                                                    { name },
                                                )}
                                            >
                                                <Ellipsis aria-hidden />
                                            </Button>
                                        }
                                    />
                                )}
                            </div>
                        )}
                    </div>
                    <div className="mt-auto flex min-w-0 items-center justify-between gap-2">
                        <span
                            data-slot="template-card-author"
                            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                        >
                            {author != null && (
                                <>
                                    <PersonAvatar
                                        name={author.name}
                                        src={author.avatarUrl}
                                        size="xs"
                                        decorative
                                    />
                                    <span className="truncate">
                                        {t('By :name', { name: author.name })}
                                    </span>
                                </>
                            )}
                        </span>
                        {useHref === null ? (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            aria-disabled="true"
                                            aria-label={useLabel}
                                            aria-describedby={hintId}
                                            className="shrink-0 cursor-not-allowed opacity-50"
                                        >
                                            {t('Use')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {t('Pick a team first')}
                                    </TooltipContent>
                                </Tooltip>
                                <span
                                    id={hintId}
                                    data-slot="template-card-hint"
                                    className="sr-only"
                                >
                                    {t('Pick a team first')}
                                </span>
                            </TooltipProvider>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="shrink-0"
                            >
                                <Link href={useHref} aria-label={useLabel}>
                                    {t('Use')}
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </article>
        </Card>
    );
}

/** The columns of a retro template, in their colours. */
export function TemplateColumnsPreview({
    columns,
}: {
    columns: TemplateColumn[];
}) {
    const { t } = useTrans();

    return (
        <ul
            aria-label={t('Columns')}
            data-slot="template-columns-preview"
            className="flex min-w-0 flex-1 gap-1.5"
        >
            {columns.map((column, index) => (
                <li
                    key={index}
                    className={cn(
                        'flex min-w-0 flex-1 flex-col gap-1 rounded-sm border border-(--col-border) bg-(--col) p-1.5',
                        columnColorClass(column.color),
                    )}
                >
                    <span className="truncate text-overline font-bold text-(--col-text)">
                        {column.title}
                    </span>
                    <span
                        aria-hidden
                        className="h-3 rounded-xs bg-card/70 shadow-card"
                    />
                    <span
                        aria-hidden
                        className="h-3 rounded-xs bg-card/70 shadow-card"
                    />
                </li>
            ))}
        </ul>
    );
}

/** One titled block of the templates page: icon, title, a sentence, actions. */
export function TemplatesSection({
    icon: Icon,
    title,
    hint,
    actions,
    headingRef,
    children,
}: {
    icon: LucideIcon;
    title: string;
    hint?: string;
    /** The heading takes the focus when a dialog closes on a card that is gone. */
    headingRef?: Ref<HTMLHeadingElement>;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            data-slot="templates-section"
            className="flex min-w-0 flex-col gap-3"
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2
                    id={headingId}
                    ref={headingRef}
                    tabIndex={headingRef === undefined ? undefined : -1}
                    className="flex min-w-0 items-center gap-2 rounded-sm text-base font-title outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <Icon
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{title}</span>
                </h2>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    {hint !== undefined && (
                        <span className="min-w-0 text-xs text-muted-foreground">
                            {hint}
                        </span>
                    )}
                    {actions}
                </div>
            </div>
            {children}
        </section>
    );
}
