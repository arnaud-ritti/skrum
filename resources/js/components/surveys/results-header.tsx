import { Check, Ellipsis, FileDown, Lock, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { SurveyStatus } from '@/lib/surveys/types';

export type ResultsHeaderProps = {
    status: SurveyStatus;
    isEditor: boolean;
    /** An editor of a closed survey at or above its threshold. */
    canExport: boolean;
    /** The CSV export, a plain link: the server answers with the file. */
    exportUrl: string;
    onSetStatus: (status: SurveyStatus) => Promise<void>;
    /** The trigger of the Share dialog. */
    share?: ReactNode;
};

const ActionLabel = 'truncate max-md:sr-only';

/** The status of the survey, beside the page title. */
export function ResultsStatus({ status }: { status: SurveyStatus }) {
    const { t } = useTrans();

    if (status === 'closed') {
        return (
            <Badge variant="success" icon={Check}>
                <span className="truncate">{t('Survey closed')}</span>
            </Badge>
        );
    }

    return (
        <Badge variant="soft" dot="var(--skrum-success)">
            <span className="truncate">{t('Open')}</span>
        </Badge>
    );
}

/**
 * The actions of the results, at the end of the topbar, as the mockup: "Export
 * CSV" and the share trigger; "Close the survey" while it is open, and
 * "Reopen" in the "…" menu of an editor once it is closed. On a phone the
 * actions keep their icons, their names read out.
 */
export function ResultsHeader({
    status,
    isEditor,
    canExport,
    exportUrl,
    onSetStatus,
    share,
}: ResultsHeaderProps) {
    const { t } = useTrans();
    const [confirming, setConfirming] = useState(false);
    const [closeError, setCloseError] = useState<string | undefined>();
    const [reopening, setReopening] = useState(false);
    const isClosed = status === 'closed';

    const close = async (): Promise<void> => {
        setCloseError(undefined);

        try {
            await onSetStatus('closed');
        } catch (error) {
            setCloseError(t('Something went wrong. Please try again.'));

            throw error;
        }
    };

    const reopen = async (): Promise<void> => {
        setReopening(true);

        try {
            await onSetStatus('open');
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        } finally {
            setReopening(false);
        }
    };

    return (
        <div
            data-slot="survey-results-header"
            className="flex shrink-0 items-center gap-2"
        >
            {canExport && (
                <Button asChild variant="outline">
                    <a href={exportUrl}>
                        <FileDown aria-hidden="true" />
                        <span className={ActionLabel}>{t('Export CSV')}</span>
                    </a>
                </Button>
            )}
            {share}
            {isEditor && !isClosed && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setCloseError(undefined);
                        setConfirming(true);
                    }}
                >
                    <Lock aria-hidden="true" />
                    <span className={ActionLabel}>{t('Close the survey')}</span>
                </Button>
            )}
            {isEditor && isClosed && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            aria-label={t('More actions')}
                        >
                            <Ellipsis aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            disabled={reopening}
                            onSelect={() => void reopen()}
                        >
                            <RotateCcw aria-hidden="true" />
                            {t('Reopen')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {isEditor && (
                <ConfirmDialog
                    open={confirming}
                    onOpenChange={setConfirming}
                    title={t('Close the survey?')}
                    description={t(
                        'People can no longer answer. You can reopen it.',
                    )}
                    confirmLabel={t('Close the survey')}
                    error={closeError}
                    onConfirm={close}
                />
            )}
        </div>
    );
}
