import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { PasswordField } from '@/components/auth/password-field';
import { usePasswordGate } from '@/components/settings/password-gate';
import { SettingsCard } from '@/components/settings/settings-card';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { VisitError, deleteVisit } from '@/lib/visit';

/** Not `password`: the password card of the same page holds that id. */
const PasswordFieldId = 'delete-account-password';

type DeleteAccountCardProps = {
    /**
     * The password is typed in the dialog; a code confirms the session
     * before the dialog opens when the owner knows no password; null when no
     * code can reach the account (rule S-1): nothing is asked.
     */
    confirmsWith: 'password' | 'code' | null;
};

export function DeleteAccountCard({
    confirmsWith,
}: DeleteAccountCardProps): ReactElement {
    const { t } = useTrans();
    const { guard } = usePasswordGate();
    const needsPassword = confirmsWith === 'password';
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string>();

    const changeOpen = (next: boolean): void => {
        setOpen(next);

        if (!next) {
            setError(undefined);
        }
    };

    const deleteAccount = async (data: FormData): Promise<void> => {
        const password = data.get('password');

        setError(undefined);

        try {
            await deleteVisit(
                ProfileController.destroy.url(),
                needsPassword
                    ? { password: typeof password === 'string' ? password : '' }
                    : undefined,
            );
        } catch (failure) {
            setError(
                (failure instanceof VisitError
                    ? failure.errors.password
                    : undefined) ??
                    t('Something went wrong. Please try again.'),
            );
            if (needsPassword) {
                requestAnimationFrame(() =>
                    document.getElementById(PasswordFieldId)?.focus(),
                );
            }

            throw failure;
        }
    };

    return (
        <SettingsCard
            tone="destructive"
            title={t('Delete account')}
            description={t(
                'Permanently removes your profile and tokens. Cards you wrote stay, shown as "Former member".',
            )}
        >
            <Button
                type="button"
                variant="destructive"
                size="sm"
                data-test="delete-user-button"
                className="max-w-full"
                onClick={() =>
                    confirmsWith === 'code'
                        ? guard(() => changeOpen(true))
                        : changeOpen(true)
                }
            >
                <Trash2 aria-hidden="true" />
                <span className="truncate">{t('Delete account')}</span>
            </Button>
            <FormDialog
                open={open}
                onOpenChange={changeOpen}
                tone="destructive"
                title={t('Are you sure you want to delete your account?')}
                description={
                    needsPassword
                        ? t(
                              'Your profile and tokens are deleted for good. Cards you wrote stay, shown as "Former member". Enter your password to confirm.',
                          )
                        : t(
                              'Your profile and tokens are deleted for good. Cards you wrote stay, shown as "Former member".',
                          )
                }
                submitLabel={t('Delete account')}
                submitTest="confirm-delete-user-button"
                onSubmit={deleteAccount}
                error={needsPassword ? undefined : error}
            >
                {needsPassword && (
                    <PasswordField
                        id={PasswordFieldId}
                        name="password"
                        label={t('Password')}
                        required
                        autoComplete="current-password"
                        error={error}
                    />
                )}
            </FormDialog>
        </SettingsCard>
    );
}
