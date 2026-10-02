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
import { EmailCodeRow } from '@/components/settings/security/email-code-row';
import { RecoveryCodes } from '@/components/settings/security/recovery-codes';
import {
    turnOffButtonClass,
    TwoFactorRow as Row,
} from '@/components/settings/security/two-factor-row';
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
import type { EmailSecondFactor, TwoFactorSummary } from '@/types/auth';

type TwoFactorCardProps = {
    enabled: boolean;
    /** The server asks for a code before it turns the second factor on. */
    requiresConfirmation: boolean;
    summary: TwoFactorSummary;
    /** The server offers the authenticator app; without it only the e-mail code is listed. */
    appAvailable?: boolean;
    /** The e-mail code, a second method of the same card. */
    emailCode?: EmailSecondFactor;
};

/** At this many recovery codes or fewer, the card asks for new ones. */
const LowRecoveryCodes = 3;

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

export function TwoFactorCard({
    enabled,
    requiresConfirmation,
    summary,
    appAvailable = true,
    emailCode,
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
    const [codesRegenerated, setCodesRegenerated] = useState(false);
    const [turnOffOpen, setTurnOffOpen] = useState(false);
    const [turnOffError, setTurnOffError] = useState<string>();
    const [regenerateOpen, setRegenerateOpen] = useState(false);
    const [regenerateError, setRegenerateError] = useState<string>();
    const wasEnabled = useRef(enabled);
    const codesId = useId();

    useEffect(() => {
        if (wasEnabled.current && !enabled) {
            clearTwoFactorAuthData();
            setCodesVisible(false);
        }

        wasEnabled.current = enabled;
    }, [enabled, clearTwoFactorAuthData]);

    /* A method the instance cannot deliver is listed only while it is on, to be turned off. */
    const listedEmailCode =
        emailCode !== undefined && (emailCode.available || emailCode.enabled)
            ? emailCode
            : undefined;
    const listsEmailCode = listedEmailCode !== undefined;
    const emailCodeOn = listedEmailCode?.enabled === true;
    const anyMethodOn = enabled || emailCodeOn;

    const title = t('Two-factor authentication');
    const description = listsEmailCode
        ? t(
              'A 6-digit code on top of your password, from an authenticator app or by e-mail.',
          )
        : t(
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

        setCodesRegenerated(false);
        setCodesVisible((visible) => !visible);
    };

    const showRegeneratedCodes = (): void => {
        setCodesVisible(true);
        setCodesRegenerated(true);
        void loadCodes();
    };

    /** Settles like `deleteVisit`: resolved by the redirect, rejected by a visit that ended without one. */
    const regenerate = async (): Promise<void> => {
        setRegenerateError(undefined);

        try {
            await new Promise<void>((resolve, reject) => {
                router.post(
                    regenerateRecoveryCodes.url(),
                    {},
                    {
                        preserveScroll: true,
                        onSuccess: () => resolve(),
                        onError: () => reject(new Error()),
                        onFinish: () => reject(new Error()),
                    },
                );
            });
        } catch (failure) {
            setRegenerateError(t('Something went wrong. Please try again.'));

            throw failure;
        }

        showRegeneratedCodes();
    };

    const changeRegenerateOpen = (open: boolean): void => {
        if (!open) {
            setRegenerateError(undefined);
        }

        setRegenerateOpen(open);
    };

    const codesLeft = summary.recoveryCodesRemaining;

    /** With no code left there is nothing to view: only a regeneration helps. */
    const hasCodesToView = codesLeft !== 0;

    const lowCodesTitle = (left: number): string => {
        if (left === 0) {
            return t('No recovery codes left');
        }

        if (left === 1) {
            return t('Only one recovery code left');
        }

        return t('Only :count recovery codes left', { count: left });
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
                {anyMethodOn ? (
                    <Badge variant="success" shape="pill" icon={Check}>
                        {t('Two-factor on')}
                    </Badge>
                ) : (
                    <Badge variant="muted" shape="pill">
                        {t('Two-factor off')}
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

    if (!enabled && !listsEmailCode) {
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
                            {t('Two-factor off')}
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

    const recoveryCodesRow = (
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
                <div className="flex max-w-full min-w-0 flex-wrap gap-2">
                    {hasCodesToView && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-expanded={codesVisible}
                            aria-controls={codesVisible ? codesId : undefined}
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
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full"
                        onClick={() => setRegenerateOpen(true)}
                    >
                        <RotateCcw aria-hidden="true" />
                        <span className="truncate">
                            {t('Regenerate codes')}
                        </span>
                    </Button>
                </div>
            }
        >
            {codesLeft !== null && codesLeft <= LowRecoveryCodes && (
                <Alert
                    data-slot="recovery-codes-alert"
                    variant={codesLeft === 0 ? 'destructive' : 'warning'}
                    title={lowCodesTitle(codesLeft)}
                    description={
                        codesLeft === 0
                            ? t(
                                  'If you lose your phone, you may not be able to sign in. Regenerate your codes now.',
                              )
                            : t(
                                  'Regenerate your codes to get :total new ones. The old ones stop working.',
                                  { total: summary.recoveryCodesTotal },
                              )
                    }
                />
            )}
            <p
                role="status"
                data-slot="recovery-codes-status"
                className="sr-only"
            >
                {codesRegenerated && hasCodesToView
                    ? t('New recovery codes generated.')
                    : ''}
            </p>
            {codesVisible && hasCodesToView && (
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
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'Each recovery code can be used once. Regenerating them makes the old codes invalid.',
                                )}
                            </p>
                        </>
                    )}
                </div>
            )}
        </Row>
    );

    /** With the e-mail code listed, each method is turned off on its own row. */
    const appAction = (): ReactNode => {
        if (!enabled) {
            return (
                <LoadingButton
                    type="button"
                    size="sm"
                    loading={starting}
                    className="max-w-full"
                    onClick={start}
                >
                    <ShieldCheck aria-hidden="true" />
                    <span className="truncate">
                        {hasSetupData ? t('Continue setup') : t('Enable 2FA')}
                    </span>
                </LoadingButton>
            );
        }

        if (!listsEmailCode) {
            return undefined;
        }

        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={turnOffButtonClass}
                onClick={() => setTurnOffOpen(true)}
            >
                <ShieldOff aria-hidden="true" />
                <span className="truncate">
                    {emailCodeOn ? t('Turn off the app') : t('Turn off 2FA')}
                </span>
            </Button>
        );
    };

    return (
        <SettingsCard
            title={title}
            description={description}
            flush
            header={
                <>
                    {anyMethodOn ? (
                        <IconTile icon={ShieldCheck} tone="success" />
                    ) : (
                        <IconTile icon={Smartphone} />
                    )}
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                        {title}
                    </span>
                    {anyMethodOn ? (
                        <Badge variant="success" shape="pill" icon={Check}>
                            {t('Two-factor on')}
                        </Badge>
                    ) : (
                        <Badge variant="muted" shape="pill">
                            {t('Two-factor off')}
                        </Badge>
                    )}
                </>
            }
        >
            {appAvailable && (
                <Row
                    icon={Smartphone}
                    title={t('Authenticator app')}
                    description={
                        enabled
                            ? addedOn
                            : t('A 6-digit code from an app on your phone.')
                    }
                    action={appAction()}
                />
            )}
            {enabled && recoveryCodesRow}
            {listedEmailCode !== undefined && (
                <EmailCodeRow {...listedEmailCode} appEnabled={enabled} />
            )}
            {enabled && !listsEmailCode && (
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
                            className={turnOffButtonClass}
                            onClick={() => setTurnOffOpen(true)}
                        >
                            <ShieldOff aria-hidden="true" />
                            <span className="truncate">
                                {t('Turn off 2FA')}
                            </span>
                        </Button>
                    }
                />
            )}
            {enabled && (
                <ConfirmDialog
                    open={regenerateOpen}
                    onOpenChange={changeRegenerateOpen}
                    error={regenerateError}
                    tone="destructive"
                    title={t('Regenerate the recovery codes?')}
                    description={t(
                        'Your current codes stop working at once. Store the new ones in a safe place.',
                    )}
                    confirmLabel={t('Regenerate codes')}
                    onConfirm={regenerate}
                />
            )}
            {enabled && (
                <ConfirmDialog
                    open={turnOffOpen}
                    onOpenChange={changeTurnOffOpen}
                    error={turnOffError}
                    tone="destructive"
                    title={
                        emailCodeOn
                            ? t('Turn off the authenticator app?')
                            : t('Turn off two-factor authentication?')
                    }
                    description={
                        emailCodeOn
                            ? t(
                                  'Your recovery codes stop working. The e-mail code keeps protecting your account.',
                              )
                            : t(
                                  'Your account will be protected by your password only.',
                              )
                    }
                    confirmLabel={
                        emailCodeOn ? t('Turn off the app') : t('Turn off 2FA')
                    }
                    onConfirm={turnOff}
                />
            )}
        </SettingsCard>
    );
}
