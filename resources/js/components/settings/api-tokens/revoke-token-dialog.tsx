import { router } from '@inertiajs/react';
import type { ReactElement } from 'react';
import ApiTokensController from '@/actions/App/Http/Controllers/Settings/ApiTokensController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';
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

    const revoke = (target: ApiToken): Promise<void> =>
        new Promise((resolve, reject) => {
            router.delete(ApiTokensController.destroy.url(target.id), {
                preserveScroll: true,
                onSuccess: () => resolve(),
                onError: () => reject(new Error('The token is still here.')),
            });
        });

    return (
        <ConfirmDialog
            open={open && token !== null}
            onOpenChange={onOpenChange}
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
