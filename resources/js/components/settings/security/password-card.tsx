import { Form } from '@inertiajs/react';
import { CircleCheck } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import { PasswordField } from '@/components/auth/password-field';
import {
    PasswordRules,
    PasswordStrength,
} from '@/components/settings/security/password-strength';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';

const CurrentPasswordId = 'current_password';
const NewPasswordId = 'password';

type PasswordCardProps = {
    /** The server's rule, as `Password::defaults()->toPasswordRulesString()`. */
    passwordRules: string;
    /** Last item of the rule list: `PasswordBreachCheck` when the server's rule has one. */
    breachCheck?: ReactNode;
};

export function PasswordCard({
    passwordRules,
    breachCheck,
}: PasswordCardProps): ReactElement {
    const { t } = useTrans();
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const matches = confirmation !== '' && confirmation === password;

    const clear = (): void => {
        setPassword('');
        setConfirmation('');
    };

    return (
        <Form
            {...SecurityController.update.form()}
            options={{ preserveScroll: true }}
            resetOnError={[
                'password',
                'password_confirmation',
                'current_password',
            ]}
            resetOnSuccess
            onSuccess={clear}
            onError={(errors) => {
                clear();

                if (errors.password) {
                    document.getElementById(NewPasswordId)?.focus();
                }

                if (errors.current_password) {
                    document.getElementById(CurrentPasswordId)?.focus();
                }
            }}
            data-slot="password-card"
            className="min-w-0"
        >
            {({ errors, processing }) => (
                <SettingsCard
                    title={t('Password')}
                    description={t(
                        'Ensure your account is using a long, random password to stay secure',
                    )}
                    footer={
                        <LoadingButton
                            type="submit"
                            size="sm"
                            loading={processing}
                            data-test="update-password-button"
                            className="max-w-full"
                        >
                            <span className="truncate">
                                {t('Update password')}
                            </span>
                        </LoadingButton>
                    }
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <PasswordField
                            id={CurrentPasswordId}
                            name="current_password"
                            label={t('Current password')}
                            autoComplete="current-password"
                            error={errors.current_password}
                        />
                    </div>

                    <div className="grid items-start gap-4 sm:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <PasswordField
                                id={NewPasswordId}
                                name="password"
                                label={t('New password')}
                                autoComplete="new-password"
                                passwordrules={passwordRules}
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                error={errors.password}
                            />
                            <PasswordStrength password={password} />
                        </div>
                        <PasswordField
                            id="password_confirmation"
                            name="password_confirmation"
                            label={t('Confirm new password')}
                            autoComplete="new-password"
                            passwordrules={passwordRules}
                            value={confirmation}
                            onChange={(event) =>
                                setConfirmation(event.target.value)
                            }
                            error={errors.password_confirmation}
                            mark={
                                matches ? (
                                    <CircleCheck
                                        role="img"
                                        aria-label={t('Passwords match')}
                                        className="size-4 text-skrum-success-text"
                                    />
                                ) : undefined
                            }
                        />
                    </div>

                    <PasswordRules
                        rules={passwordRules}
                        password={password}
                        breachCheck={breachCheck}
                    />
                </SettingsCard>
            )}
        </Form>
    );
}
