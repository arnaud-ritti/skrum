import { Head } from '@inertiajs/react';
import { PasskeysCard } from '@/components/settings/security/passkeys-card';
import { PasswordCard } from '@/components/settings/security/password-card';
import { SecurityStack } from '@/components/settings/security/security-stack';
import { TwoFactorCard } from '@/components/settings/security/two-factor-card';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type { Passkey, TwoFactorSummary } from '@/types/auth';

type Props = {
    passwordRules: string;
    twoFactor: TwoFactorSummary;
    canManageTwoFactor?: boolean;
    requiresConfirmation?: boolean;
    twoFactorEnabled?: boolean;
    canManagePasskeys?: boolean;
    passkeys?: Passkey[];
};

export default function Security({
    passwordRules,
    twoFactor,
    canManageTwoFactor = false,
    requiresConfirmation = false,
    twoFactorEnabled = false,
    canManagePasskeys = false,
    passkeys = [],
}: Props) {
    const { t } = useTrans();

    const description = (): string => {
        if (canManageTwoFactor && canManagePasskeys) {
            return t('Password, two-factor authentication and passkeys.');
        }

        if (canManageTwoFactor) {
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
                <PasswordCard passwordRules={passwordRules} />
                {canManageTwoFactor && (
                    <TwoFactorCard
                        enabled={twoFactorEnabled}
                        requiresConfirmation={requiresConfirmation}
                        summary={twoFactor}
                    />
                )}
                {canManagePasskeys && <PasskeysCard passkeys={passkeys} />}
            </SecurityStack>
        </SettingsShell>
    );
}
