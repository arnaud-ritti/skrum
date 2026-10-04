import { router, usePage } from '@inertiajs/react';
import { CircleAlert, Copy, PlugZap } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import SsoConnectionTestsController from '@/actions/App/Http/Controllers/Admin/SsoConnectionTestsController';
import { UnsavedBar } from '@/components/admin/branding/unsaved-bar';
import { ConfigurationField } from '@/components/admin/configuration/configuration-field';
import { SecretField } from '@/components/admin/configuration/secret-field';
import { useConfigurationForm } from '@/components/admin/configuration/use-configuration-form';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDaysAgo } from '@/lib/days-ago';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type {
    SsoLastTest,
    SsoProviderDetails,
    SsoTestResult,
} from '@/lib/admin/types';
import { cn } from '@/lib/utils';
import { ConnectionTestResult } from './connection-test-result';
import { EmailFallbackRow } from './email-fallback-row';

const CopiedMs = 2000;

/** The issuer or the tenant first, then the client ID and secret side by side, then the rest. */
const LeadingFields = ['base_url', 'tenant'];
const PairedFields = ['client_id', 'client_secret'];

export type ProviderCardProps = {
    provider: SsoProviderDetails;
    /** No fresh password confirmation (rule S2): the fields are read-only. */
    needsConfirmation: boolean;
    onConfirmationRefused: () => void;
    /** The label of another card with unsaved changes: one card is edited at a time. */
    lockedBy: string | null;
    onDirtyChange: (dirty: boolean) => void;
    /** The topbar's place for the unsaved-changes bar of the card being edited. */
    barSlot?: HTMLElement | null;
    lastTest: SsoLastTest | null;
    testResult: SsoTestResult | null;
};

export function ProviderCard({
    provider,
    needsConfirmation,
    onConfirmationRefused,
    lockedBy,
    onDirtyChange,
    barSlot = null,
    lastTest,
    testResult,
}: ProviderCardProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const id = useId();
    const titleId = `${id}-title`;
    const formId = `${id}-form`;
    const redirectId = `${id}-redirect`;
    const form = useConfigurationForm(provider.fields, provider.updateUrl, {
        onConfirmationRefused,
    });
    const [askedToFinish, setAskedToFinish] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testError, setTestError] = useState<string>();
    const [copiedText, copy] = useClipboard();
    const [copied, setCopied] = useState(false);
    const dirty = form.dirtyCount > 0;
    const isLocked = lockedBy !== null;
    const readOnly = needsConfirmation || isLocked || form.processing;
    const labels: Record<string, string> = {
        base_url: t('Issuer URL'),
        tenant: t('Tenant ID'),
        client_id: t('Client ID'),
        client_secret: t('Client secret'),
        label: t('Button label'),
    };
    const names = Object.keys(provider.fields);
    const leading = names.filter((name) => LeadingFields.includes(name));
    const paired = names.filter((name) => PairedFields.includes(name));
    const rest = names.filter(
        (name) => !LeadingFields.includes(name) && !PairedFields.includes(name),
    );

    useEffect(() => {
        onDirtyChange(dirty);
    }, [dirty, onDirtyChange]);

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timer = window.setTimeout(() => setCopied(false), CopiedMs);

        return () => window.clearTimeout(timer);
    }, [copied, copiedText]);

    function save(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        if (!dirty || readOnly) {
            return;
        }

        form.submit();
    }

    async function copyRedirectUri(): Promise<void> {
        if (await copy(provider.redirectUri)) {
            setCopied(true);
        }
    }

    function test(): void {
        router.post(
            SsoConnectionTestsController.store.url(),
            { provider: provider.key },
            {
                preserveScroll: true,
                onStart: () => {
                    setTesting(true);
                    setTestError(undefined);
                },
                onFinish: () => setTesting(false),
                onError: (errors) => setTestError(errors.provider),
            },
        );
    }

    function field(name: string) {
        const description = provider.fields[name];
        const common = {
            name,
            label: labels[name] ?? name,
            description,
            value: String(form.value(name) ?? ''),
            onChange: (value: string) => form.setValue(name, value),
            clearing: form.isClearing(name),
            onClearingChange: (clearing: boolean) =>
                form.setClearing(name, clearing),
            readOnly,
            error: form.errors[name],
        };

        if (description.secret) {
            return <SecretField key={name} {...common} />;
        }

        return <ConfigurationField key={name} {...common} />;
    }

    const secretChanged =
        provider.secretChangedAt === null
            ? null
            : t('Secret changed :relative', {
                  relative: formatDaysAgo(
                      provider.secretChangedAt,
                      locale,
                      Date.now(),
                  ),
              });

    return (
        <section
            aria-labelledby={titleId}
            data-slot="sso-provider-card"
            data-provider={provider.key}
            className="flex min-w-0 flex-col gap-3"
        >
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <h2
                    id={titleId}
                    className="min-w-0 text-xl font-title tracking-heading"
                >
                    {provider.label}
                </h2>
                {provider.configured ? (
                    <Badge variant="success">{t('Configured')}</Badge>
                ) : (
                    <Badge variant="outline">{t('Not configured')}</Badge>
                )}
            </div>
            <Card>
                <form
                    id={formId}
                    onSubmit={save}
                    aria-labelledby={titleId}
                    className="flex min-w-0 flex-col"
                >
                    <fieldset
                        className="flex min-w-0 flex-col gap-4 p-5"
                        onFocus={() => {
                            if (isLocked) {
                                setAskedToFinish(true);
                            }
                        }}
                    >
                        <legend className="sr-only">{provider.label}</legend>
                        {isLocked && askedToFinish && (
                            <p
                                role="status"
                                className="rounded-lg bg-skrum-info-soft px-4 py-3 text-sm text-skrum-info-text"
                            >
                                {t(
                                    'Save or cancel the changes to :provider first.',
                                    { provider: lockedBy },
                                )}
                            </p>
                        )}
                        {form.errors.section !== undefined && (
                            <Alert variant="destructive">
                                <CircleAlert aria-hidden="true" />
                                <span className="min-w-0">
                                    {form.errors.section}
                                </span>
                            </Alert>
                        )}
                        {leading.map(field)}
                        {paired.length > 0 && (
                            <div className="grid min-w-0 gap-4 @md/card:grid-cols-2">
                                {paired.map(field)}
                            </div>
                        )}
                        {rest.map(field)}
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
                                <Label htmlFor={redirectId}>
                                    {t('Redirect URI')}{' '}
                                    <span className="font-medium text-muted-foreground">
                                        {t('(to declare with the provider)')}
                                    </span>
                                </Label>
                                {copied && (
                                    <span
                                        role="status"
                                        className="text-xs font-medium text-skrum-success-text"
                                    >
                                        {t('Copied')}
                                    </span>
                                )}
                            </div>
                            <div className="relative min-w-0">
                                <Input
                                    id={redirectId}
                                    value={provider.redirectUri}
                                    readOnly
                                    className="bg-muted pr-10 font-mono"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t('Copy')}
                                    onClick={() => void copyRedirectUri()}
                                    className="absolute inset-y-0.5 right-0.5 h-auto text-muted-foreground"
                                >
                                    <Copy aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                        <EmailFallbackRow />
                        {provider.testable && (
                            <ConnectionTestResult
                                result={testResult}
                                lastTest={lastTest}
                            />
                        )}
                    </fieldset>
                    <div
                        data-slot="sso-provider-card-footer"
                        className="flex min-w-0 flex-col gap-2 rounded-b-xl border-t bg-muted/50 px-5 py-3"
                    >
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                            {provider.testable && (
                                <LoadingButton
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    loading={testing}
                                    disabled={dirty}
                                    aria-describedby={
                                        dirty ? `${id}-test-hint` : undefined
                                    }
                                    onClick={test}
                                >
                                    <PlugZap aria-hidden="true" />
                                    {t('Test the connection')}
                                </LoadingButton>
                            )}
                            {secretChanged !== null && (
                                <span className="text-xs text-muted-foreground">
                                    {secretChanged}
                                </span>
                            )}
                            <div className="ml-auto flex shrink-0 items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={!dirty || form.processing}
                                    onClick={form.reset}
                                >
                                    {t('Cancel')}
                                </Button>
                                <LoadingButton
                                    type="submit"
                                    size="sm"
                                    loading={form.processing}
                                    disabled={!dirty || needsConfirmation}
                                >
                                    {t('Save')}
                                </LoadingButton>
                            </div>
                        </div>
                        {provider.testable && dirty && (
                            <p
                                id={`${id}-test-hint`}
                                className="text-xs text-muted-foreground"
                            >
                                {t('Save first to test these values.')}
                            </p>
                        )}
                        {testError !== undefined && (
                            <p
                                role="alert"
                                className="text-body-sm text-skrum-destructive-text"
                            >
                                {testError}
                            </p>
                        )}
                        <p className={cn('text-xs text-muted-foreground')}>
                            {t(
                                'Every change is recorded in the audit log and mailed to every instance admin.',
                            )}
                        </p>
                    </div>
                </form>
            </Card>
            {barSlot !== null &&
                dirty &&
                createPortal(
                    <UnsavedBar
                        count={form.dirtyCount}
                        saving={form.processing}
                        canSave={!needsConfirmation}
                        onCancel={form.reset}
                        form={formId}
                    />,
                    barSlot,
                )}
        </section>
    );
}
