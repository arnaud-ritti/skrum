import { Check, FileDown, Lock, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

/** The status badge and the actions of the results, at the end of the topbar; on a phone the actions keep their icons, their names read out. */
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
            {isClosed ? (
                <Badge variant="success" icon={Check}>
                    <span className="truncate">{t('Survey closed')}</span>
                </Badge>
            ) : (
                <Badge variant="soft" dot="var(--skrum-success)">
                    <span className="truncate">{t('Open')}</span>
                </Badge>
            )}
            {canExport && (
                <Button asChild variant="outline" size="sm">
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
                    size="sm"
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
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reopening}
                    onClick={() => void reopen()}
                >
                    <RotateCcw aria-hidden="true" />
                    <span className={ActionLabel}>{t('Reopen')}</span>
                </Button>
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
