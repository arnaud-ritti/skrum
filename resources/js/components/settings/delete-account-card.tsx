import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { PasswordField } from '@/components/auth/password-field';
import { SettingsCard } from '@/components/settings/settings-card';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

const PasswordFieldId = 'password';

export function DeleteAccountCard(): ReactElement {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string>();

    const changeOpen = (next: boolean): void => {
        setOpen(next);

        if (!next) {
            setError(undefined);
        }
    };

    const deleteAccount = (data: FormData): Promise<void> =>
        new Promise((resolve, reject) => {
            const password = data.get('password');

            setError(undefined);

            router.delete(ProfileController.destroy.url(), {
                data: {
                    password: typeof password === 'string' ? password : '',
                },
                preserveScroll: true,
                onSuccess: () => resolve(),
                onError: (errors) => {
                    setError(
                        errors.password ??
                            t('Something went wrong. Please try again.'),
                    );
                    reject(new Error('The account was not deleted.'));
                    requestAnimationFrame(() =>
                        document.getElementById(PasswordFieldId)?.focus(),
                    );
                },
            });
        });

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
                onClick={() => changeOpen(true)}
            >
                <Trash2 aria-hidden="true" />
                <span className="truncate">{t('Delete account')}</span>
            </Button>
            <FormDialog
                open={open}
                onOpenChange={changeOpen}
                tone="destructive"
                title={t('Are you sure you want to delete your account?')}
                description={t(
                    'Once your account is deleted, all of its resources and data will also be permanently deleted. Please enter your password to confirm you would like to permanently delete your account.',
                )}
                submitLabel={t('Delete account')}
                submitTest="confirm-delete-user-button"
                onSubmit={deleteAccount}
            >
                <PasswordField
                    id={PasswordFieldId}
                    name="password"
                    label={t('Password')}
                    required
                    autoComplete="current-password"
                    error={error}
                />
            </FormDialog>
        </SettingsCard>
    );
}
