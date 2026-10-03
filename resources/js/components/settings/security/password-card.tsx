import { Form } from '@inertiajs/react';
import { CircleCheck } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import { PasswordField } from '@/components/auth/password-field';
import {
    BreachLine,
    BreachLineId,
} from '@/components/settings/security/breach-line';
import {
    PasswordRules,
    PasswordStrength,
} from '@/components/settings/security/password-strength';
import { useBreachCheck } from '@/components/settings/security/use-breach-check';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';

const CurrentPasswordId = 'current_password';
const NewPasswordId = 'password';

type PasswordCardProps = {
    /** The server's rule, as `Password::defaults()->toPasswordRulesString()`. */
    passwordRules: string;
    /** The server refuses a password found in known data breaches. */
    checksCompromisedPasswords: boolean;
    /** The instance answers the breach ranges, so the password is checked while it is typed. */
    liveBreachCheck: boolean;
    /**
     * False when the account has no password its owner knows: the card sets
     * a first one, without a current password and without a confirmation
     * (rule S-1, the owner's accepted risk).
     */
    isSet?: boolean;
};

export function PasswordCard({
    passwordRules,
    checksCompromisedPasswords,
    liveBreachCheck,
    isSet = true,
}: PasswordCardProps): ReactElement {
    const { t } = useTrans();
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const breach = useBreachCheck(
        password,
        liveBreachCheck && checksCompromisedPasswords,
    );
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
                    title={isSet ? t('Password') : t('Set a password')}
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
                                {isSet
                                    ? t('Update password')
                                    : t('Set the password')}
                            </span>
                        </LoadingButton>
                    }
                >
                    {isSet && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <PasswordField
                                id={CurrentPasswordId}
                                name="current_password"
                                label={t('Current password')}
                                autoComplete="current-password"
                                error={errors.current_password}
                            />
                        </div>
                    )}

                    <div className="grid items-start gap-4 sm:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <PasswordField
                                id={NewPasswordId}
                                name="password"
                                label={t('New password')}
                                autoComplete="new-password"
                                passwordrules={passwordRules}
                                aria-describedby={
                                    breach === 'breached'
                                        ? BreachLineId
                                        : undefined
                                }
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
                        breachCheck={
                            checksCompromisedPasswords ? (
                                <BreachLine
                                    state={breach}
                                    liveBreachCheck={liveBreachCheck}
                                    checksCompromisedPasswords
                                />
                            ) : undefined
                        }
                    />
                </SettingsCard>
            )}
        </Form>
    );
}
