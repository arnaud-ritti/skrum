import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    open: boolean;
    /** The selected rows, or every matching item. */
    count: number;
    /** The server's sentence when the list changed since it was counted. */
    changedSentence?: string;
    /** Rejects to keep the dialog open. */
    onConfirm: () => Promise<void>;
    onCancel: () => void;
};

/** A bulk deletion is confirmed first; `ItemDeleteConfirm` is its model. */
export function BulkDeleteConfirm({
    open,
    count,
    changedSentence,
    onConfirm,
    onCancel,
}: Props) {
    const { t } = useTrans();

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onCancel();
                }
            }}
            title={
                count === 1
                    ? t('Delete 1 action item?')
                    : t('Delete :count action items?', { count })
            }
            description={t(
                'This cannot be undone. Their comments and sub-tasks are deleted too.',
            )}
            error={changedSentence}
            confirmLabel={t('Delete')}
            tone="destructive"
            onConfirm={onConfirm}
        />
    );
}
