import { CircleAlert, Copy } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import {
    ConfigurationField,
    describedBy,
    FieldNotes,
    useFieldIds,
    useSourceHint,
} from '@/components/admin/configuration/configuration-field';
import type { ConfigurationFieldBaseProps } from '@/components/admin/configuration/configuration-field';
import { ConfirmationLine } from '@/components/admin/configuration/confirmation-line';
import { SecretField } from '@/components/admin/configuration/secret-field';
import { useConfigurationForm } from '@/components/admin/configuration/use-configuration-form';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type {
    ConfigurationValue,
    IntegrationProviderSettings,
} from '@/lib/admin/types';

const CopiedMs = 2000;

/** The GitHub App's private key: a pasted PEM, in a text area without an eye. */
const MultilineSecrets = ['private_key'];

const SwitchFields = ['enabled', 'personal_tokens'];

const HostListFields = ['allowed_hosts'];

export type IntegrationAppDialogProps = {
    provider: IntegrationProviderSettings;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** No fresh password confirmation (rule S2): the fields are read-only. */
    needsConfirmation: boolean;
    confirmUrl: string;
    onConfirmationRefused: () => void;
};

type ValueFieldProps = Omit<
    ConfigurationFieldBaseProps,
    'value' | 'onChange'
> & {
    value: ConfigurationValue;
    onChange: (value: ConfigurationValue) => void;
};

function SwitchConfigurationField({
    name,
    label,
    description,
    value,
    onChange,
    clearing,
    onClearingChange,
    readOnly = false,
    error,
}: ValueFieldProps) {
    const { inputId, hintId, errorId } = useFieldIds(name);
    const hint = useSourceHint(description);
    const clearable = description.source === 'stored';

    return (
        <div
            data-slot="configuration-field"
            data-source={description.source}
            className="flex min-w-0 flex-col gap-1.5"
        >
            <Switch
                id={inputId}
                label={label}
                checked={value === true}
                onCheckedChange={(checked) => onChange(checked)}
                disabled={readOnly || clearing}
                aria-invalid={error !== undefined ? true : undefined}
                aria-describedby={describedBy(
                    (clearing || hint !== null || clearable) && hintId,
                    error !== undefined && errorId,
                )}
            />
            <FieldNotes
                hint={hint}
                clearable={clearable}
                clearing={clearing}
                onClearingChange={onClearingChange}
                readOnly={readOnly}
                hintId={hintId}
                error={error}
                errorId={errorId}
            />
        </div>
    );
}

function hostsFrom(text: string): string[] {
    return text
        .split(/[\s,]+/)
        .map((host) => host.trim())
        .filter((host) => host !== '');
}

/** A list of host names typed on one line; what is typed stays as typed while it means the same list. */
function HostsConfigurationField({
    name,
    label,
    description,
    value,
    onChange,
    clearing,
    onClearingChange,
    readOnly = false,
    error,
}: ValueFieldProps) {
    const { t } = useTrans();
    const { inputId, hintId, errorId } = useFieldIds(name);
    const hint = useSourceHint(description);
    const clearable = description.source === 'stored';
    const hosts = Array.isArray(value) ? value : [];
    const [text, setText] = useState(hosts.join(', '));
    const formatId = `${inputId}-format`;

    if (JSON.stringify(hostsFrom(text)) !== JSON.stringify(hosts)) {
        setText(hosts.join(', '));
    }

    return (
        <div
            data-slot="configuration-field"
            data-source={description.source}
            className="flex min-w-0 flex-col gap-1.5"
        >
            <Label htmlFor={inputId}>{label}</Label>
            <Input
                id={inputId}
                name={name}
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    onChange(hostsFrom(event.target.value));
                }}
                readOnly={readOnly || clearing}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                aria-invalid={error !== undefined ? true : undefined}
                aria-describedby={describedBy(
                    formatId,
                    (clearing || hint !== null || clearable) && hintId,
                    error !== undefined && errorId,
                )}
            />
            <p id={formatId} className="text-body-sm text-muted-foreground">
                {t('Host names, separated by commas.')}
            </p>
            <FieldNotes
                hint={hint}
                clearable={clearable}
                clearing={clearing}
                onClearingChange={onClearingChange}
                readOnly={readOnly}
                hintId={hintId}
                error={error}
                errorId={errorId}
            />
        </div>
    );
}

function CopyField({
    label,
    copyLabel,
    value,
}: {
    label: string;
    copyLabel: string;
    value: string;
}) {
    const { t } = useTrans();
    const inputId = useId();
    const [copiedText, copy] = useClipboard();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timer = window.setTimeout(() => setCopied(false), CopiedMs);

        return () => window.clearTimeout(timer);
    }, [copied, copiedText]);

    async function copyValue(): Promise<void> {
        if (await copy(value)) {
            setCopied(true);
        }
    }

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
                <Label htmlFor={inputId}>{label}</Label>
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
                    id={inputId}
                    value={value}
                    readOnly
                    className="bg-muted pr-10 font-mono"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copyLabel}
                    onClick={() => void copyValue()}
                    className="absolute inset-y-0.5 right-0.5 h-auto text-muted-foreground"
                >
                    <Copy aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}

/** The instance's app credentials for one integration provider (spec §9.5). */
export function IntegrationAppDialog({
    provider,
    open,
    onOpenChange,
    needsConfirmation,
    confirmUrl,
    onConfirmationRefused,
}: IntegrationAppDialogProps) {
    const { t } = useTrans();
    const formId = useId();
    const [askingToClear, setAskingToClear] = useState(false);
    const form = useConfigurationForm(provider.fields, provider.updateUrl, {
        onConfirmationRefused,
        onSaved: () => {
            form.reset();
            onOpenChange(false);
        },
    });
    const names = Object.keys(provider.fields);
    const dirty = form.dirtyCount > 0;
    const readOnly = needsConfirmation || form.processing;
    const clears = names.some((name) => form.isClearing(name));
    const labels: Record<string, string> = {
        client_id: t('Client ID'),
        client_secret: t('Client secret'),
        webhook_secret: t('Webhook secret'),
        bot_token: t('Bot token'),
        base_url: t('Server URL'),
        url: t('Server URL'),
        personal_tokens: t('Personal access tokens'),
        app_id: t('App ID'),
        slug: t('App slug'),
        private_key: t('Private key'),
        enabled: t('Enabled'),
        allowed_hosts: t('Allowed hosts'),
    };

    function changeOpen(next: boolean): void {
        if (!next) {
            form.reset();
        }

        onOpenChange(next);
    }

    function save(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        if (!dirty || readOnly) {
            return;
        }

        if (clears && provider.connectedTeams > 0) {
            setAskingToClear(true);

            return;
        }

        form.submit();
    }

    function field(name: string) {
        const description = provider.fields[name];
        const common = {
            name,
            label: labels[name] ?? name,
            description,
            clearing: form.isClearing(name),
            onClearingChange: (clearing: boolean) =>
                form.setClearing(name, clearing),
            readOnly,
            error: form.errors[name],
        };

        if (SwitchFields.includes(name)) {
            return (
                <SwitchConfigurationField
                    key={name}
                    {...common}
                    value={form.value(name)}
                    onChange={(value) => form.setValue(name, value)}
                />
            );
        }

        if (HostListFields.includes(name)) {
            return (
                <HostsConfigurationField
                    key={name}
                    {...common}
                    value={form.value(name)}
                    onChange={(value) => form.setValue(name, value)}
                />
            );
        }

        const text = {
            ...common,
            value: String(form.value(name) ?? ''),
            onChange: (value: string) => form.setValue(name, value),
        };

        if (description.secret) {
            return (
                <SecretField
                    key={name}
                    {...text}
                    multiline={MultilineSecrets.includes(name)}
                />
            );
        }

        return <ConfigurationField key={name} {...text} />;
    }

    return (
        <>
            <Dialog open={open} onOpenChange={changeOpen}>
                <DialogContent closeLabel={t('Close')} className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t(':provider app', { provider: provider.label })}
                        </DialogTitle>
                        <DialogDescription>
                            {t('Every change is recorded in the audit log.')}
                        </DialogDescription>
                    </DialogHeader>
                    <ConfirmationLine
                        visible={needsConfirmation}
                        confirmUrl={confirmUrl}
                    />
                    <form
                        id={formId}
                        onSubmit={save}
                        className="flex min-w-0 flex-col gap-4"
                    >
                        {form.errors.section !== undefined && (
                            <Alert variant="destructive">
                                <CircleAlert aria-hidden="true" />
                                <span className="min-w-0">
                                    {form.errors.section}
                                </span>
                            </Alert>
                        )}
                        {names.map(field)}
                        {provider.callbackUrl !== null && (
                            <CopyField
                                label={t('Callback URL')}
                                copyLabel={t('Copy the callback URL')}
                                value={provider.callbackUrl}
                            />
                        )}
                        {provider.webhookUrl !== null && (
                            <CopyField
                                label={t('Webhook URL')}
                                copyLabel={t('Copy the webhook URL')}
                                value={provider.webhookUrl}
                            />
                        )}
                    </form>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={form.processing}
                            onClick={() => changeOpen(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form={formId}
                            disabled={!dirty || readOnly}
                        >
                            {t('Save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={askingToClear}
                onOpenChange={setAskingToClear}
                tone="destructive"
                title={t("Clear :name's app?", { name: provider.label })}
                description={
                    provider.connectedTeams === 1
                        ? t(
                              '1 team loses it until it is configured again. Its settings are kept.',
                          )
                        : t(
                              ':count teams lose it until it is configured again. Their settings are kept.',
                              { count: provider.connectedTeams },
                          )
                }
                confirmLabel={t('Clear')}
                onConfirm={async () => form.submit()}
            />
        </>
    );
}
