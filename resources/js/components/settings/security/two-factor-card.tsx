import { Form, router, usePage } from '@inertiajs/react';
import {
    Check,
    Eye,
    EyeOff,
    Key,
    RotateCcw,
    ShieldCheck,
    ShieldOff,
    Smartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { RecoveryCodes } from '@/components/settings/security/recovery-codes';
import {
    StepNumber,
    TwoFactorSetup,
} from '@/components/settings/security/two-factor-setup';
import { SettingsCard } from '@/components/settings/settings-card';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTrans } from '@/hooks/use-trans';
import { OTP_MAX_LENGTH, useTwoFactorAuth } from '@/hooks/use-two-factor-auth';
import { deleteVisit } from '@/lib/delete-visit';
import { cn } from '@/lib/utils';
import {
    confirm,
    disable,
    enable,
    regenerateRecoveryCodes,
} from '@/routes/two-factor';
import type { TwoFactorSummary } from '@/types/auth';

type TwoFactorCardProps = {
    enabled: boolean;
    /** The server asks for a code before it turns the second factor on. */
    requiresConfirmation: boolean;
    summary: TwoFactorSummary;
};

/** `scan`: QR code, key and code. `codes`: the recovery codes, once, to save. */
type SetupStep = 'scan' | 'codes' | null;

function IconTile({
    icon: Icon,
    tone = 'muted',
}: {
    icon: LucideIcon;
    tone?: 'muted' | 'success';
}): ReactElement {
    return (
        <span
            className={cn(
                'grid size-8 shrink-0 place-items-center rounded-md [&>svg]:size-4',
                tone === 'success'
                    ? 'bg-skrum-success-soft text-skrum-success-text'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            <Icon aria-hidden="true" />
        </span>
    );
}

function Row({
    icon: Icon,
    destructive = false,
    title,
    description,
    action,
    children,
}: {
    icon: LucideIcon;
    destructive?: boolean;
    title: string;
    description?: string;
    action?: ReactNode;
    children?: ReactNode;
}): ReactElement {
    return (
        <div
            data-slot="two-factor-row"
            className="flex min-w-0 flex-col gap-4 border-b px-5 py-4 last:border-b-0"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
                <Icon
                    aria-hidden="true"
                    className={cn(
                        'size-5 shrink-0',
                        destructive
                            ? 'text-skrum-destructive-text'
                            : 'text-muted-foreground',
                    )}
                />
                <div className="flex min-w-0 flex-1 basis-56 flex-col">
                    <span className="text-sm font-semibold">{title}</span>
                    {description !== undefined && (
                        <span className="text-sm text-muted-foreground">
                            {description}
                        </span>
                    )}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

export function TwoFactorCard({
    enabled,
    requiresConfirmation,
    summary,
}: TwoFactorCardProps): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage<{ locale?: string }>().props;
    const {
        qrCodeSvg,
        manualSetupKey,
        hasSetupData,
        clearSetupData,
        clearTwoFactorAuthData,
        fetchSetupData,
        recoveryCodesList,
        fetchRecoveryCodes,
        errors: fetchErrors,
    } = useTwoFactorAuth();
    const [step, setStep] = useState<SetupStep>(null);
    const [starting, setStarting] = useState(false);
    const [code, setCode] = useState('');
    const [saved, setSaved] = useState(false);
    const [codesVisible, setCodesVisible] = useState(false);
    const [codesLoading, setCodesLoading] = useState(false);
    const [turnOffOpen, setTurnOffOpen] = useState(false);
    const [turnOffError, setTurnOffError] = useState<string>();
    const wasEnabled = useRef(enabled);
    const codesId = useId();

    useEffect(() => {
        if (wasEnabled.current && !enabled) {
            clearTwoFactorAuthData();
            setCodesVisible(false);
        }

        wasEnabled.current = enabled;
    }, [enabled, clearTwoFactorAuthData]);

    const title = t('Two-factor authentication');
    const description = t(
        'A 6-digit code from an authenticator app, on top of your password.',
    );

    const loadCodes = async (): Promise<void> => {
        setCodesLoading(true);

        try {
            await fetchRecoveryCodes();
        } finally {
            setCodesLoading(false);
        }
    };

    const hasCodes = recoveryCodesList.length > 0;

    const failureAlert = (messages: string[], retry: () => void): ReactNode =>
        messages.length > 0 && (
            <Alert
                variant="destructive"
                title={t('Something went wrong.')}
                description={
                    <ul className="list-inside list-disc">
                        {Array.from(new Set(messages)).map((error) => (
                            <li key={error}>{t(error)}</li>
                        ))}
                    </ul>
                }
                action={
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full"
                        onClick={retry}
                    >
                        <span className="truncate">{t('Retry')}</span>
                    </Button>
                }
            />
        );

    const setupFailures = failureAlert(
        fetchErrors,
        () => void fetchSetupData(),
    );

    /** An answer without a code is a failed fetch, not an endless wait. */
    const codesFailures = failureAlert(
        fetchErrors.length === 0 && !codesLoading && !hasCodes
            ? ['Failed to fetch recovery codes']
            : fetchErrors,
        () => void loadCodes(),
    );

    const showCodes = (): void => {
        setSaved(false);
        setStep('codes');
        void loadCodes();
    };

    const start = (): void => {
        if (hasSetupData) {
            setStep('scan');

            return;
        }

        setStarting(true);
        router.post(
            enable.url(),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCode('');
                    setStep('scan');
                    void fetchSetupData();
                },
                onFinish: () => setStarting(false),
            },
        );
    };

    const finish = (): void => {
        clearSetupData();
        setCode('');
        setStep(null);
    };

    const turnOff = async (): Promise<void> => {
        setTurnOffError(undefined);

        try {
            await deleteVisit(disable.url());
        } catch (failure) {
            setTurnOffError(t('Something went wrong. Please try again.'));

            throw failure;
        }
    };

    const changeTurnOffOpen = (open: boolean): void => {
        if (!open) {
            setTurnOffError(undefined);
        }

        setTurnOffOpen(open);
    };

    const toggleCodes = (): void => {
        if (!codesVisible && !hasCodes) {
            void loadCodes();
        }

        setCodesVisible((visible) => !visible);
    };

    if (step === 'codes') {
        return (
            <SettingsCard
                title={title}
                description={description}
                header={
                    <>
                        <StepNumber>{requiresConfirmation ? 3 : 2}</StepNumber>
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-semibold">
                                {t('Save your recovery codes')}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                {t(
                                    'If you lose your phone, each code lets you sign in once.',
                                )}
                            </span>
                        </div>
                    </>
                }
                footer={
                    <>
                        <div className="min-w-0 flex-1 basis-56">
                            <Checkbox
                                id="recovery-codes-saved"
                                checked={saved}
                                disabled={!hasCodes}
                                onCheckedChange={(checked) =>
                                    setSaved(checked === true)
                                }
                                label={t('I have saved my recovery codes')}
                            />
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            disabled={!saved || !hasCodes}
                            className="max-w-full"
                            onClick={finish}
                        >
                            <span className="truncate">{t('Finish')}</span>
                        </Button>
                    </>
                }
            >
                {codesFailures || (
                    <>
                        <Alert
                            variant="warning"
                            title={t('Keep these codes somewhere safe.')}
                            description={t(
                                'Store them in a password manager; anyone with a code can bypass your 2FA.',
                            )}
                        />
                        <RecoveryCodes
                            codes={recoveryCodesList}
                            loading={codesLoading}
                            placeholders={summary.recoveryCodesTotal}
                        />
                    </>
                )}
            </SettingsCard>
        );
    }

    if (step === 'scan') {
        const header = (
            <>
                <IconTile icon={Smartphone} />
                <span className="min-w-0 flex-1 text-sm font-semibold">
                    {title}
                </span>
                {enabled ? (
                    <Badge variant="success" shape="pill" icon={Check}>
                        {t('On')}
                    </Badge>
                ) : (
                    <Badge variant="muted" shape="pill">
                        {t('Off')}
                    </Badge>
                )}
            </>
        );

        if (!requiresConfirmation) {
            return (
                <SettingsCard
                    title={title}
                    description={description}
                    header={header}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="max-w-full"
                                onClick={() => setStep(null)}
                            >
                                <span className="truncate">{t('Cancel')}</span>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={!hasSetupData}
                                className="max-w-full"
                                onClick={showCodes}
                            >
                                <span className="truncate">
                                    {t('Continue')}
                                </span>
                            </Button>
                        </>
                    }
                >
                    {setupFailures || (
                        <TwoFactorSetup
                            qrCodeSvg={qrCodeSvg}
                            manualSetupKey={manualSetupKey}
                            requiresConfirmation={false}
                            code=""
                            onCodeChange={() => undefined}
                            processing={false}
                        />
                    )}
                </SettingsCard>
            );
        }

        return (
            <Form
                {...confirm.form()}
                options={{ preserveScroll: true }}
                onSuccess={showCodes}
                onError={() => setCode('')}
                data-slot="two-factor-confirm"
                className="min-w-0"
            >
                {({
                    processing,
                    errors,
                }: {
                    processing: boolean;
                    errors?: {
                        confirmTwoFactorAuthentication?: { code?: string };
                    };
                }) => (
                    <SettingsCard
                        title={title}
                        description={description}
                        header={header}
                        footer={
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={processing}
                                    className="max-w-full"
                                    onClick={() => setStep(null)}
                                >
                                    <span className="truncate">
                                        {t('Cancel')}
                                    </span>
                                </Button>
                                <LoadingButton
                                    type="submit"
                                    size="sm"
                                    loading={processing}
                                    disabled={code.length < OTP_MAX_LENGTH}
                                    className="max-w-full"
                                >
                                    <ShieldCheck aria-hidden="true" />
                                    <span className="truncate">
                                        {t('Enable 2FA')}
                                    </span>
                                </LoadingButton>
                            </>
                        }
                    >
                        {setupFailures || (
                            <TwoFactorSetup
                                qrCodeSvg={qrCodeSvg}
                                manualSetupKey={manualSetupKey}
                                requiresConfirmation
                                code={code}
                                onCodeChange={setCode}
                                codeError={
                                    errors?.confirmTwoFactorAuthentication?.code
                                }
                                processing={processing}
                            />
                        )}
                    </SettingsCard>
                )}
            </Form>
        );
    }

    if (!enabled) {
        return (
            <SettingsCard
                title={title}
                description={description}
                header={
                    <>
                        <IconTile icon={Smartphone} />
                        <span className="min-w-0 flex-1 text-sm font-semibold">
                            {title}
                        </span>
                        <Badge variant="muted" shape="pill">
                            {t('Off')}
                        </Badge>
                    </>
                }
                footer={
                    <LoadingButton
                        type="button"
                        size="sm"
                        loading={starting}
                        className="max-w-full"
                        onClick={start}
                    >
                        <ShieldCheck aria-hidden="true" />
                        <span className="truncate">
                            {hasSetupData
                                ? t('Continue setup')
                                : t('Enable 2FA')}
                        </span>
                    </LoadingButton>
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'When you enable two-factor authentication, you will be prompted for a secure pin during login. This pin can be retrieved from a TOTP-supported application on your phone.',
                    )}
                </p>
            </SettingsCard>
        );
    }

    const addedOn =
        summary.confirmedAt === null
            ? undefined
            : t('Added on :date', {
                  date: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'long',
                  }).format(new Date(summary.confirmedAt)),
              });

    return (
        <SettingsCard
            title={title}
            description={description}
            flush
            header={
                <>
                    <IconTile icon={ShieldCheck} tone="success" />
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                        {title}
                    </span>
                    <Badge variant="success" shape="pill" icon={Check}>
                        {t('On')}
                    </Badge>
                </>
            }
        >
            <Row
                icon={Smartphone}
                title={t('Authenticator app')}
                description={addedOn}
            />
            <Row
                icon={Key}
                title={t('Recovery codes')}
                description={
                    summary.recoveryCodesRemaining === null
                        ? undefined
                        : t(':left of :total recovery codes left', {
                              left: summary.recoveryCodesRemaining,
                              total: summary.recoveryCodesTotal,
                          })
                }
                action={
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-expanded={codesVisible}
                        aria-controls={codesId}
                        className="max-w-full"
                        onClick={toggleCodes}
                    >
                        {codesVisible ? (
                            <EyeOff aria-hidden="true" />
                        ) : (
                            <Eye aria-hidden="true" />
                        )}
                        <span className="truncate">
                            {codesVisible
                                ? t('Hide recovery codes')
                                : t('View recovery codes')}
                        </span>
                    </Button>
                }
            >
                {codesVisible && (
                    <div id={codesId} className="flex min-w-0 flex-col gap-3">
                        {codesFailures || (
                            <>
                                <RecoveryCodes
                                    codes={recoveryCodesList}
                                    loading={codesLoading}
                                    placeholders={
                                        summary.recoveryCodesRemaining ??
                                        summary.recoveryCodesTotal
                                    }
                                />
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">
                                        {t(
                                            'Each recovery code can be used once. Regenerating them makes the old codes invalid.',
                                        )}
                                    </p>
                                    <Form
                                        {...regenerateRecoveryCodes.form()}
                                        options={{ preserveScroll: true }}
                                        onSuccess={() => void loadCodes()}
                                    >
                                        {({ processing }) => (
                                            <LoadingButton
                                                type="submit"
                                                variant="outline"
                                                size="sm"
                                                loading={processing}
                                                className="max-w-full"
                                            >
                                                <RotateCcw aria-hidden="true" />
                                                <span className="truncate">
                                                    {t('Regenerate codes')}
                                                </span>
                                            </LoadingButton>
                                        )}
                                    </Form>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Row>
            <Row
                icon={ShieldOff}
                destructive
                title={t('Turn off two-factor authentication')}
                description={t(
                    'Your account will be protected by your password only.',
                )}
                action={
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full border-[color-mix(in_oklch,var(--destructive)_45%,var(--input))] text-skrum-destructive-text hover:text-skrum-destructive-text"
                        onClick={() => setTurnOffOpen(true)}
                    >
                        <ShieldOff aria-hidden="true" />
                        <span className="truncate">{t('Turn off 2FA')}</span>
                    </Button>
                }
            />
            <ConfirmDialog
                open={turnOffOpen}
                onOpenChange={changeTurnOffOpen}
                error={turnOffError}
                tone="destructive"
                title={t('Turn off two-factor authentication?')}
                description={t(
                    'Your account will be protected by your password only.',
                )}
                confirmLabel={t('Turn off 2FA')}
                onConfirm={turnOff}
            />
        </SettingsCard>
    );
}
