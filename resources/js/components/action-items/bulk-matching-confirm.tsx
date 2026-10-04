import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    open: boolean;
    /** The matching items the change is sent for. */
    count: number;
    /** The server's sentence when the list changed since it was counted. */
    changedSentence?: string;
    /** Rejects to keep the dialog open. */
    onApply: () => Promise<void>;
    onCancel: () => void;
};

/** A change of every matching item is confirmed first, with its count (P24-11). */
export function BulkMatchingConfirm({
    open,
    count,
    changedSentence,
    onApply,
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
            title={t('Apply to :count action items?', { count })}
            description={t(
                'Every action item matching the filters is changed: :count in all.',
                { count },
            )}
            error={changedSentence}
            confirmLabel={t('Apply')}
            onConfirm={onApply}
        />
    );
}
