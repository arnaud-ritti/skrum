import { Link, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

/** One closed standalone survey of the team: `TeamDataController`. */
export type ClosedTeamSurvey = {
    id: string;
    title: string;
    closedAt: string | null;
    exportUrl: string;
};

type DataExportProps = {
    closedSurveys: ClosedTeamSurvey[];
    estimatesUrl: string;
    actionItemsUrl: string;
};

function ExportRow({
    title,
    sentence,
    action,
    children,
}: {
    title: string;
    sentence: string;
    action?: ReactNode;
    children?: ReactNode;
}): ReactElement {
    return (
        <div className="flex min-w-0 flex-col gap-3 px-5 py-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{sentence}</p>
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

/** The Data & export tab: links to the exports that exist, and what deleting keeps. */
export function DataExport({
    closedSurveys,
    estimatesUrl,
    actionItemsUrl,
}: DataExportProps): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const closedOn = (closedAt: string): string =>
        t('Closed on :date', {
            date: new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
            }).format(new Date(closedAt)),
        });

    return (
        <>
            <SettingsCard title={t('Exports')} flush>
                <div className="flex min-w-0 flex-col divide-y">
                    <ExportRow
                        title={t('Survey results (CSV)')}
                        sentence={t(
                            'One CSV file per closed survey of the team.',
                        )}
                    >
                        {closedSurveys.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t('No closed survey yet.')}
                            </p>
                        ) : (
                            <ul className="flex min-w-0 flex-col divide-y rounded-lg border">
                                {closedSurveys.map((survey) => (
                                    <li
                                        key={survey.id}
                                        data-test="survey-export"
                                        className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2"
                                    >
                                        <div className="flex min-w-0 flex-1 basis-48 flex-col">
                                            <span className="truncate text-sm font-medium">
                                                {survey.title}
                                            </span>
                                            {survey.closedAt !== null && (
                                                <span className="text-xs text-muted-foreground">
                                                    {closedOn(survey.closedAt)}
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                        >
                                            <a href={survey.exportUrl} download>
                                                <Download aria-hidden />
                                                {t('Download CSV')}{' '}
                                                <span className="sr-only">
                                                    {survey.title}
                                                </span>
                                            </a>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ExportRow>
                    <ExportRow
                        title={t('Estimates')}
                        sentence={t(
                            "The estimates saved in the team's planning poker games.",
                        )}
                        action={
                            <Button variant="outline" size="sm" asChild>
                                <Link href={estimatesUrl}>
                                    {t('Estimation history')}
                                </Link>
                            </Button>
                        }
                    />
                    <ExportRow
                        title={t('Action items')}
                        sentence={t(
                            "The team's action items, on the action items page.",
                        )}
                        action={
                            <Button variant="outline" size="sm" asChild>
                                <Link
                                    href={actionItemsUrl}
                                    data-test="action-items-link"
                                >
                                    {t('See all')}
                                </Link>
                            </Button>
                        }
                    />
                </div>
            </SettingsCard>
            <SettingsCard title={t('What is kept')}>
                <p className="text-sm text-muted-foreground">
                    {t(
                        "Deleting the team deletes its sessions, action items and settings. Guests' names live only in the sessions they joined.",
                    )}
                </p>
            </SettingsCard>
        </>
    );
}
