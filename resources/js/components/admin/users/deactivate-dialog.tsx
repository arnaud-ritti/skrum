import { useState } from 'react';
import type { ReactElement } from 'react';
import UserDeactivationsController from '@/actions/App/Http/Controllers/Admin/UserDeactivationsController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';
import type { AdminUser } from '@/lib/admin/types';
import { VisitError, visitAsPromise } from '@/lib/visit';

type DeactivateDialogProps = {
    /** The account to deactivate; the last one asked for while the dialog closes. */
    user: AdminUser | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function DeactivateDialog({
    user,
    open,
    onOpenChange,
}: DeactivateDialogProps): ReactElement {
    const { t } = useTrans();
    const [error, setError] = useState<string>();

    const confirm = async (target: AdminUser): Promise<void> => {
        setError(undefined);

        try {
            await visitAsPromise(
                'post',
                UserDeactivationsController.store.url(target.id),
            );
        } catch (failure) {
            setError(
                failure instanceof VisitError &&
                    failure.errors.user !== undefined
                    ? failure.errors.user
                    : t('Something went wrong. Please try again.'),
            );

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
            open={open && user !== null}
            onOpenChange={changeOpen}
            error={error}
            tone="destructive"
            title={t('Deactivate :name?', { name: user?.name ?? '' })}
            description={t(
                "They are signed out and can't sign in until you reactivate them. Their content stays.",
            )}
            confirmLabel={t('Deactivate')}
            onConfirm={() =>
                user === null ? Promise.resolve() : confirm(user)
            }
        />
    );
}
