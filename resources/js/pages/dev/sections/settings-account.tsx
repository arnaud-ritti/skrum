import { usePage } from '@inertiajs/react';
import { Check, Smartphone } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    activeToken,
    expiredToken,
    orphanToken,
} from '@/components/settings/api-tokens/fixtures';
import { NewTokenPanel } from '@/components/settings/api-tokens/new-token-panel';
import { TokenCards } from '@/components/settings/api-tokens/token-cards';
import { TokensTable } from '@/components/settings/api-tokens/tokens-table';
import { ThemePicker } from '@/components/settings/appearance/theme-picker';
import {
    PasswordBreachCheck,
    PasswordRules,
    PasswordStrength,
} from '@/components/settings/security/password-strength';
import { RecoveryCodes } from '@/components/settings/security/recovery-codes';
import { TwoFactorSetup } from '@/components/settings/security/two-factor-setup';
import { SettingsCard } from '@/components/settings/settings-card';
import { TextField } from '@/components/skrum/text-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Appearance } from '@/hooks/use-appearance';
import { useTrans } from '@/hooks/use-trans';
import { tokenDateFormatter } from '@/lib/api-tokens';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

const passwordRules =
    'minlength: 12; required: lower; required: upper; required: digit;';

const setupKey = 'JBSWY3DPEHPK3PXP';

const recoveryCodes = [
    'q7Kd2mXpLs-9VwTz4HbNc',
    'p9VwR3hTbA-c6NfJ8rZyU',
    'l2YeK5qAkM-w8TdS4mVsE',
    'b3GhT9xPnQ-r5JcL2wFlD',
    'h7ZqN6eUdC-n4KsM8bYtR',
    'f2MaP7cRwX-t6HvB3jQeZ',
    'x4DnS8kLmW-g5PcV9rTaY',
    'z8BtH2yJfK-m3QwN6eXuC',
];

/** The refusal is the server's sentence, already in the member's language. */
const refusedCode = 'The provided two factor authentication code was invalid.';

const QrSize = 21;

/** A drawn stand-in for Fortify's QR code: the same picture on every render. */
const qrCodeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${QrSize} ${QrSize}" fill="var(--foreground)">${Array.from(
    { length: QrSize * QrSize },
    (_, index) => {
        const x = index % QrSize;
        const y = Math.floor(index / QrSize);

        return (x * 7 + y * 13 + x * y) % 3 === 0
            ? `<rect x="${x}" y="${y}" width="1" height="1"/>`
            : '';
    },
).join('')}</svg>`;

const tokens = [activeToken, orphanToken, expiredToken];

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function InteractiveTheme() {
    const [value, setValue] = useState<Appearance>('system');

    return <ThemePicker value={value} onChange={setValue} />;
}

function InteractiveSetup({ codeError }: { codeError?: string }) {
    const [code, setCode] = useState(codeError === undefined ? '482' : '');

    return (
        <TwoFactorSetup
            qrCodeSvg={qrCodeSvg}
            manualSetupKey={setupKey}
            requiresConfirmation
            code={code}
            onCodeChange={setCode}
            codeError={codeError}
            processing={false}
        />
    );
}

export default function SettingsAccountSection() {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const formatDate = tokenDateFormatter(locale, t('Never'));

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t(
                    'Settings card: body and footer, header and rows, destructive',
                )}
            >
                <div className="flex max-w-200 min-w-0 flex-col gap-10">
                    <SettingsCard
                        title={t('Profile')}
                        description={t(
                            'How teammates see you in sessions and on cards.',
                        )}
                        footer={
                            <>
                                <p className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
                                    {t(
                                        'A changed email address has to be verified again.',
                                    )}
                                </p>
                                <Button type="button" size="sm">
                                    <span className="truncate">
                                        {t('Save')}
                                    </span>
                                </Button>
                            </>
                        }
                    >
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">
                            <TextField
                                id="bench-profile-name"
                                label={t('Name')}
                                defaultValue="Camille Roux"
                            />
                            <TextField
                                id="bench-profile-email"
                                type="email"
                                label={t('Email')}
                                defaultValue="camille@atlas.dev"
                            />
                        </div>
                    </SettingsCard>
                    <SettingsCard
                        title={t('Two-factor authentication')}
                        flush
                        header={
                            <>
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                                    <Smartphone
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-semibold">
                                    {t('Two-factor authentication')}
                                </span>
                                <Badge
                                    variant="success"
                                    shape="pill"
                                    icon={Check}
                                >
                                    {t('Two-factor on')}
                                </Badge>
                            </>
                        }
                    >
                        <p className="border-b px-5 py-4 text-sm">
                            {t('Authenticator app')}
                        </p>
                        <p className="px-5 py-4 text-sm">
                            {t('Recovery codes')}
                        </p>
                    </SettingsCard>
                    <SettingsCard
                        tone="destructive"
                        title={t('Delete account')}
                        description={t(
                            'Permanently removes your profile and tokens. Cards you wrote stay, shown as "Former member".',
                        )}
                    >
                        <Button type="button" variant="destructive" size="sm">
                            <span className="truncate">
                                {t('Delete account')}
                            </span>
                        </Button>
                    </SettingsCard>
                </div>
            </Example>
            <Example
                label={t(
                    'Password strength: nothing typed, weak, good, strong, and the rule of the server',
                )}
            >
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(64)),1fr))] gap-6">
                    <PasswordStrength password="" />
                    <PasswordStrength password="abc" />
                    <PasswordStrength password="abcdefghijklmn" />
                    <PasswordStrength password="Abcdefgh-ijklmn-42" />
                </div>
                <PasswordRules
                    rules={passwordRules}
                    password="Abcdefgh"
                    breachCheck={<PasswordBreachCheck />}
                />
            </Example>
            <Example
                label={t(
                    'Two-factor setup: loading, a code being typed, a refused code',
                )}
            >
                <div className="flex max-w-200 min-w-0 flex-col gap-6">
                    <Card className="p-5">
                        <TwoFactorSetup
                            qrCodeSvg={null}
                            manualSetupKey={null}
                            requiresConfirmation
                            code=""
                            onCodeChange={noop}
                            processing={false}
                        />
                    </Card>
                    <Card className="p-5">
                        <InteractiveSetup />
                    </Card>
                    <Card className="p-5">
                        <InteractiveSetup codeError={refusedCode} />
                    </Card>
                </div>
            </Example>
            <Example label={t('Recovery codes: loading, eight codes')}>
                <div className="flex max-w-200 min-w-0 flex-col gap-6">
                    <RecoveryCodes codes={[]} loading />
                    <RecoveryCodes codes={recoveryCodes} />
                </div>
            </Example>
            <Example label={t('Theme picker: System, Light, Dark')}>
                <div className="max-w-200 min-w-0">
                    <InteractiveTheme />
                </div>
            </Example>
            <Example
                label={t(
                    'API tokens: the table, and the cards of a narrow list',
                )}
            >
                <div className="flex min-w-0 flex-col gap-6">
                    <Card className="min-w-0">
                        <TokensTable
                            tokens={tokens}
                            formatDate={formatDate}
                            newTokenName={activeToken.name}
                            onRevoke={noop}
                        />
                    </Card>
                    <Card className="max-w-sm min-w-0">
                        <TokenCards
                            tokens={tokens}
                            formatDate={formatDate}
                            newTokenName={activeToken.name}
                            onRevoke={noop}
                        />
                    </Card>
                </div>
            </Example>
            <Example label={t('New token, shown once')}>
                <Card className="max-w-200 min-w-0">
                    <NewTokenPanel
                        token={{
                            name: activeToken.name,
                            plainText:
                                '0199a000-0000-7000-8000-0000000000c1|skrum_7Hq2vN9xLk4mR8tW3yBc5dF1gJ6pZs0a',
                        }}
                        mcpUrl="https://skrum.example/mcp"
                        onDone={noop}
                    />
                </Card>
            </Example>
        </div>
    );
}
