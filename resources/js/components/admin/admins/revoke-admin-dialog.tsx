import type { InstanceAdmin } from '@/components/admin/admins/types';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';

export function RevokeAdminDialog({
    admin,
    open,
    onOpenChange,
    onConfirm,
    error,
}: {
    admin: InstanceAdmin | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
    error?: string;
}) {
    const { t } = useTrans();

    if (admin === null) {
        return null;
    }

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            tone="destructive"
            title={
                admin.isSelf
                    ? t('Revoke your own admin rights?')
                    : t('Revoke admin rights of :name?', { name: admin.name })
            }
            description={
                admin.isSelf
                    ? t('You will lose access to Administration.')
                    : t(':name will lose access to Administration.', {
                          name: admin.name,
                      })
            }
            confirmLabel={t('Revoke')}
            onConfirm={onConfirm}
            error={error}
        />
    );
}
