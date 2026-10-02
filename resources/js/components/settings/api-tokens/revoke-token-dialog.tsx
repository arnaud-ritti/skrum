import { useState } from 'react';
import type { ReactElement } from 'react';
import ApiTokensController from '@/actions/App/Http/Controllers/Settings/ApiTokensController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';
import { deleteVisit } from '@/lib/delete-visit';
import type { ApiToken } from '@/types';

type RevokeTokenDialogProps = {
    /** The token to revoke; the last one asked for while the dialog closes. */
    token: ApiToken | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function RevokeTokenDialog({
    token,
    open,
    onOpenChange,
}: RevokeTokenDialogProps): ReactElement {
    const { t } = useTrans();

    const [error, setError] = useState<string>();

    const revoke = async (target: ApiToken): Promise<void> => {
        setError(undefined);

        try {
            await deleteVisit(ApiTokensController.destroy.url(target.id));
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
            open={open && token !== null}
            onOpenChange={changeOpen}
            error={error}
            tone="destructive"
            title={t('Revoke this token?')}
            description={t(
                'Clients using ":name" lose access on their next request.',
                { name: token?.name ?? '' },
            )}
            confirmLabel={t('Revoke')}
            onConfirm={() =>
                token === null ? Promise.resolve() : revoke(token)
            }
        />
    );
}
