import { useState } from 'react';
import type { ReactElement } from 'react';
import McpKeysController from '@/actions/App/Http/Controllers/Admin/McpKeysController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';
import type { McpKey } from '@/lib/admin/types';
import { deleteVisit } from '@/lib/delete-visit';

type RevokeKeyDialogProps = {
    /** The key to revoke; the last one asked for while the dialog closes. */
    mcpKey: McpKey | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function RevokeKeyDialog({
    mcpKey,
    open,
    onOpenChange,
}: RevokeKeyDialogProps): ReactElement {
    const { t } = useTrans();
    const [error, setError] = useState<string>();

    const revoke = async (target: McpKey): Promise<void> => {
        setError(undefined);

        try {
            await deleteVisit(McpKeysController.destroy.url(target.id));
        } catch (failure) {
            setError(t('Something went wrong. Please try again.'));

            throw failure;
        }
    };

    const changeOpen = (next: boolean): void => {
        if (!next) {
            setError(undefined);
        }

        onOpenChange(next);
    };

    return (
        <ConfirmDialog
            open={open && mcpKey !== null}
            onOpenChange={changeOpen}
            error={error}
            tone="destructive"
            title={t('Revoke :name of :owner?', {
                name: mcpKey?.name ?? '',
                owner: mcpKey?.owner.name ?? '',
            })}
            description={t('Agents using it stop at once.')}
            confirmLabel={t('Revoke')}
            onConfirm={() =>
                mcpKey === null ? Promise.resolve() : revoke(mcpKey)
            }
        />
    );
}
