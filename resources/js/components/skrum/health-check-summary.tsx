import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { InfoIcon } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';

export type HealthCheckSummaryStatement = {
    id: string;
    label: string;
    text: string;
    isBuiltin: boolean;
};

export type HealthCheckSummaryProps = {
    /** The statements asked today, in their order (no archived one). */
    statements: HealthCheckSummaryStatement[];
    /** The page that manages them; no link without it. */
    manageHref?: NonNullable<InertiaLinkProps['href']>;
    /** Defaults to "Manage"; a viewer who cannot manage gets another word. */
    manageLabel?: string;
    className?: string;
};

/**
 * The health check of a team at a glance (ScreenTeam, side column): what is
 * asked, and a link to the page that manages it.
 */
export function HealthCheckSummary({
    statements,
    manageHref,
    manageLabel,
    className,
}: HealthCheckSummaryProps) {
    const { t } = useTrans();
    const headingId = useId();

    return (
        <Card asChild data-slot="health-check-summary" className={className}>
            <section aria-labelledby={headingId}>
                <CardHeader>
                    <h2
                        id={headingId}
                        className="text-base leading-snug font-title"
                    >
                        {t('Health check')}
                    </h2>
                    <CardDescription data-slot="health-check-summary-facts">
                        {statements.length === 1
                            ? t(
                                  '1 statement, scored 1–5, asked in every health check',
                              )
                            : t(
                                  ':count statements, scored 1–5, asked in every health check',
                                  { count: statements.length },
                              )}
                    </CardDescription>
                    {manageHref !== undefined && (
                        <CardAction>
                            <Button
                                asChild
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                            >
                                <Link
                                    href={manageHref}
                                    data-slot="health-check-manage"
                                >
                                    <span className="truncate">
                                        {manageLabel ?? t('Manage')}
                                    </span>
                                </Link>
                            </Button>
                        </CardAction>
                    )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {statements.length === 0 ? (
                        <p
                            data-slot="health-check-summary-empty"
                            className="text-sm text-muted-foreground"
                        >
                            {t('No statements yet.')}
                        </p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-border">
                            {statements.map((statement) => (
                                <li
                                    key={statement.id}
                                    data-slot="health-check-summary-statement"
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
                                >
                                    <span className="min-w-0 text-sm font-semibold break-words">
                                        {statement.label}
                                    </span>
                                    <Badge
                                        variant={
                                            statement.isBuiltin
                                                ? 'muted'
                                                : 'soft'
                                        }
                                    >
                                        {statement.isBuiltin
                                            ? t('Built-in')
                                            : t('Custom')}
                                    </Badge>
                                    <span className="col-span-full text-xs break-words text-muted-foreground">
                                        {statement.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="flex items-start gap-2 rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                        <InfoIcon
                            aria-hidden
                            className="mt-0.5 size-3.5 shrink-0"
                        />
                        <span>
                            {t(
                                'Changes apply to retros that have not collected answers yet.',
                            )}
                        </span>
                    </p>
                </CardContent>
            </section>
        </Card>
    );
}
