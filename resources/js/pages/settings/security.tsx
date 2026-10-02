import { Head } from '@inertiajs/react';
import { PasskeysCard } from '@/components/settings/security/passkeys-card';
import { PasswordCard } from '@/components/settings/security/password-card';
import { PasswordBreachCheck } from '@/components/settings/security/password-strength';
import { SecurityStack } from '@/components/settings/security/security-stack';
import { TwoFactorCard } from '@/components/settings/security/two-factor-card';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type {
    EmailSecondFactor,
    Passkey,
    TwoFactorSummary,
} from '@/types/auth';

type Props = {
    passwordRules: string;
    /** The server refuses a password found in known data breaches. */
    checksCompromisedPasswords?: boolean;
    twoFactor: TwoFactorSummary;
    canManageTwoFactor?: boolean;
    requiresConfirmation?: boolean;
    twoFactorEnabled?: boolean;
    canManagePasskeys?: boolean;
    passkeys?: Passkey[];
    emailSecondFactor?: EmailSecondFactor;
};

export default function Security({
    passwordRules,
    checksCompromisedPasswords = false,
    twoFactor,
    canManageTwoFactor = false,
    requiresConfirmation = false,
    twoFactorEnabled = false,
    canManagePasskeys = false,
    passkeys = [],
    emailSecondFactor,
}: Props) {
    const { t } = useTrans();
    const listsEmailCode =
        emailSecondFactor !== undefined &&
        (emailSecondFactor.available || emailSecondFactor.enabled);
    const hasSecondFactorCard = canManageTwoFactor || listsEmailCode;

    const description = (): string => {
        if (hasSecondFactorCard && canManagePasskeys) {
            return t('Password, two-factor authentication and passkeys.');
        }

        if (hasSecondFactorCard) {
            return t('Password and two-factor authentication.');
        }

        if (canManagePasskeys) {
            return t('Password and passkeys.');
        }

        return t('The password of your account.');
    };

    return (
        <SettingsShell
            active="security"
            title={t('Security')}
            description={description()}
        >
            <Head title={t('Security settings')} />

            <SecurityStack>
                <PasswordCard
                    passwordRules={passwordRules}
                    breachCheck={
                        checksCompromisedPasswords ? (
                            <PasswordBreachCheck />
                        ) : undefined
                    }
                />
                {hasSecondFactorCard && (
                    <TwoFactorCard
                        enabled={twoFactorEnabled}
                        requiresConfirmation={requiresConfirmation}
                        summary={twoFactor}
                        appAvailable={canManageTwoFactor}
                        emailCode={emailSecondFactor}
                    />
                )}
                {canManagePasskeys && <PasskeysCard passkeys={passkeys} />}
            </SecurityStack>
        </SettingsShell>
    );
}
