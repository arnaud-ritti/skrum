import ApiTokensController from '@/actions/App/Http/Controllers/Settings/ApiTokensController';
import ConfirmFormDialog from '@/components/confirm-form-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { ApiToken } from '@/types';

export function RevokeTokenDialog({ token }: { token: ApiToken }) {
    const { t } = useTrans();

    return (
        <ConfirmFormDialog
            form={{
                ...ApiTokensController.destroy.form(token.id),
                options: { preserveScroll: true },
            }}
            title={t('Revoke this token?')}
            description={t(
                'Clients using ":name" lose access on their next request.',
                { name: token.name },
            )}
            confirmLabel={t('Revoke')}
            trigger={
                <Button size="sm" variant="ghost">
                    {t('Revoke')}
                </Button>
            }
        />
    );
}
