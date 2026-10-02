import { useState } from 'react';
import type { ReactElement } from 'react';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItem } from '@/lib/retro/types';

type Props = {
    /** The item whose deletion is asked for; `null` keeps the dialog closed. */
    item: ActionItem | null;
    onCancel: () => void;
    onConfirm: (item: ActionItem) => Promise<void>;
};

export function ItemDeleteConfirm({
    item,
    onCancel,
    onConfirm,
}: Props): ReactElement {
    const { t } = useTrans();
    const [shown, setShown] = useState(item);

    if (item !== null && item !== shown) {
        setShown(item);
    }

    const named = item ?? shown;

    return (
        <ConfirmDialog
            open={item !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onCancel();
                }
            }}
            title={t('Delete this action item?')}
            description={t(
                '“:title” is removed for everyone, with its sub-tasks and comments.',
                { title: named?.content ?? '' },
            )}
            confirmLabel={t('Delete')}
            tone="destructive"
            onConfirm={async () => {
                if (item !== null) {
                    await onConfirm(item);
                }
            }}
        />
    );
}
