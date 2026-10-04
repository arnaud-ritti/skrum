import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UnsavedBar } from '@/components/admin/branding/unsaved-bar';
import {
    ConfigurationField,
    describedBy,
    FieldNotes,
    useFieldIds,
    useSourceHint,
} from '@/components/admin/configuration/configuration-field';
import { SecretField } from '@/components/admin/configuration/secret-field';
import { useConfigurationForm } from '@/components/admin/configuration/use-configuration-form';
import type { ConfigurationForm } from '@/components/admin/configuration/use-configuration-form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    ConfigurationFieldDescription,
    MailLastTest,
    MailSettings,
} from '@/lib/admin/types';
import { MailTestForm } from './mail-test-form';

type Mailer = 'smtp' | 'log';

/** The select's item for "no scheme": a Radix item cannot carry an empty value. */
const NoScheme = 'none';

export type MailSettingsCardProps = {
    mail: MailSettings;
    updateUrl: string;
    lastTest: MailLastTest | null;
    defaultRecipient: string;
    /** No fresh password confirmation (rule S2): the fields are read-only. */
    needsConfirmation: boolean;
    onConfirmationRefused: () => void;
    /** The topbar's place for the unsaved-changes bar. */
    barSlot?: HTMLElement | null;
};

type ChoiceFieldProps = {
    name: string;
    label: string;
    description: ConfigurationFieldDescription;
    form: ConfigurationForm;
    readOnly: boolean;
    disabled?: boolean;
    children: (ids: {
        inputId: string;
        labelId: string;
        describedBy: string | undefined;
    }) => ReactNode;
};

/** A radio group or a select of a configuration section, with the same notes as a text field. */
function ChoiceField({
    name,
    label,
    description,
    form,
    readOnly,
    disabled = false,
    children,
}: ChoiceFieldProps) {
    const { inputId, hintId, errorId } = useFieldIds(name);
    const hint = useSourceHint(description);
    const clearing = form.isClearing(name);
    const clearable = description.source === 'stored';
    const error = form.errors[name];

    return (
        <div
            data-slot="configuration-field"
            data-source={description.source}
            className="flex min-w-0 flex-col gap-1.5"
        >
            <Label id={`${inputId}-label`} htmlFor={inputId}>
                {label}
            </Label>
            {children({
                inputId,
                labelId: `${inputId}-label`,
                describedBy: describedBy(
                    (clearing || hint !== null || clearable) && hintId,
                    error !== undefined && errorId,
                ),
            })}
            <FieldNotes
                hint={hint}
                clearable={clearable}
                clearing={clearing}
                onClearingChange={(next) => form.setClearing(name, next)}
                readOnly={readOnly || disabled}
                hintId={hintId}
                error={error}
                errorId={errorId}
            />
        </div>
    );
}

/** The SMTP section: the mailer, the server and the sender, then the test e-mail. */
export function MailSettingsCard({
    mail,
    updateUrl,
    lastTest,
    defaultRecipient,
    needsConfirmation,
    onConfirmationRefused,
    barSlot = null,
}: MailSettingsCardProps) {
    const { t } = useTrans();
    const id = useId();
    const titleId = `${id}-title`;
    const formId = `${id}-form`;
    const form = useConfigurationForm(mail.fields, updateUrl, {
        onConfirmationRefused,
    });
    const dirty = form.dirtyCount > 0;
    const readOnly = needsConfirmation || form.processing;
    const writesToLog = form.value('mailer') === 'log';
    const labels: Record<string, string> = {
        mailer: t('Delivery'),
        host: t('Host'),
        port: t('Port'),
        scheme: t('Encryption'),
        username: t('Username'),
        password: t('Password'),
        from_address: t('Sender address'),
        from_name: t('Sender name'),
    };
    const schemes: { value: string; label: string }[] = [
        { value: NoScheme, label: t('None') },
        { value: 'smtps', label: t('TLS on connect (smtps)') },
        { value: 'smtp', label: t('STARTTLS when offered (smtp)') },
    ];

    function save(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        if (!dirty || readOnly) {
            return;
        }

        void form.submit();
    }

    function textField(name: string, disabled = false, className?: string) {
        const description = mail.fields[name];

        if (description === undefined) {
            return null;
        }

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
            disabled,
            error: form.errors[name],
            className,
        };

        if (description.secret) {
            return <SecretField {...common} />;
        }

        return <ConfigurationField {...common} />;
    }

    function mailerField() {
        const description = mail.fields.mailer;

        if (description === undefined) {
            return null;
        }

        const clearing = form.isClearing('mailer');
        const current = String(form.value('mailer') ?? '');
        const otherMailer =
            current !== '' && current !== 'smtp' && current !== 'log';

        return (
            <ChoiceField
                name="mailer"
                label={labels.mailer}
                description={description}
                form={form}
                readOnly={readOnly}
            >
                {({ inputId, labelId, describedBy: hints }) => (
                    <>
                        <RadioGroup<Mailer>
                            id={inputId}
                            aria-labelledby={labelId}
                            aria-describedby={hints}
                            value={current as Mailer}
                            onValueChange={(value) =>
                                form.setValue('mailer', value)
                            }
                            disabled={readOnly || clearing}
                            options={[
                                {
                                    value: 'smtp',
                                    label: t('Send through SMTP'),
                                },
                                {
                                    value: 'log',
                                    label: t(
                                        "Don't send: write mails to the log",
                                    ),
                                },
                            ]}
                        />
                        {otherMailer && (
                            <p className="text-body-sm text-muted-foreground">
                                {t(
                                    'Another mailer from the environment (:mailer)',
                                    {
                                        mailer: current,
                                    },
                                )}
                            </p>
                        )}
                    </>
                )}
            </ChoiceField>
        );
    }

    function schemeField() {
        const description = mail.fields.scheme;

        if (description === undefined) {
            return null;
        }

        const current = String(form.value('scheme') ?? '');
        const clearing = form.isClearing('scheme');
        /* A blank value is not saved: the environment's encryption cannot be turned off from here. */
        const environmentScheme =
            description.source === 'environment' &&
            String(description.value ?? '') !== '';

        function choose(value: string): void {
            const scheme = value === NoScheme ? '' : value;

            form.setValue('scheme', scheme);

            /* A blank value keeps what is stored: "None" returns to the environment instead. */
            if (scheme === '' && description.source === 'stored') {
                form.setClearing('scheme', true);
            }
        }

        return (
            <ChoiceField
                name="scheme"
                label={labels.scheme}
                description={description}
                form={form}
                readOnly={readOnly}
                disabled={writesToLog}
            >
                {({ inputId, describedBy: hints }) => (
                    <Select
                        value={
                            clearing ? '' : current === '' ? NoScheme : current
                        }
                        onValueChange={choose}
                        disabled={readOnly || clearing || writesToLog}
                    >
                        <SelectTrigger
                            id={inputId}
                            aria-describedby={hints}
                            className="w-full"
                        >
                            <SelectValue
                                placeholder={t('From the environment (:env)', {
                                    env: description.envName,
                                })}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {schemes.map((scheme) => (
                                <SelectItem
                                    key={scheme.value}
                                    value={scheme.value}
                                    disabled={
                                        scheme.value === NoScheme &&
                                        environmentScheme
                                    }
                                >
                                    {scheme.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </ChoiceField>
        );
    }

    return (
        <section
            aria-labelledby={titleId}
            data-slot="mail-settings-card"
            className="flex min-w-0 flex-col gap-3"
        >
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <h2
                    id={titleId}
                    className="min-w-0 text-xl font-title tracking-heading"
                >
                    {t('SMTP')}
                </h2>
                {mail.delivering ? (
                    <Badge
                        variant="success"
                        shape="pill"
                        dot="currentColor"
                        data-slot="mail-operational"
                    >
                        {t('Operational')}
                    </Badge>
                ) : (
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-body-sm text-muted-foreground">
                            {t('Mails are written to the log.')}
                        </span>
                        <Badge variant="warning" shape="pill">
                            {t('Not configured')}
                        </Badge>
                    </span>
                )}
            </div>
            <Card>
                <form
                    id={formId}
                    onSubmit={save}
                    aria-labelledby={titleId}
                    className="flex min-w-0 flex-col gap-4 p-5"
                >
                    {form.errors.section !== undefined && (
                        <Alert variant="destructive">
                            <CircleAlert aria-hidden="true" />
                            <span className="min-w-0">
                                {form.errors.section}
                            </span>
                        </Alert>
                    )}
                    {mailerField()}
                    <div
                        data-slot="mail-transport-fields"
                        data-disabled={writesToLog ? '' : undefined}
                        className="flex min-w-0 flex-col gap-4"
                    >
                        <div className="flex min-w-0 flex-col gap-4 @md/card:flex-row">
                            {textField('host', writesToLog, 'flex-1')}
                            {textField('port', writesToLog, '@md/card:w-25')}
                        </div>
                        <div className="grid min-w-0 gap-4 @md/card:grid-cols-2">
                            {schemeField()}
                            {textField('username', writesToLog)}
                            {textField('password', writesToLog)}
                        </div>
                    </div>
                    <div className="grid min-w-0 gap-4 @md/card:grid-cols-2">
                        {textField('from_address')}
                        {textField('from_name')}
                    </div>
                </form>
                <div
                    data-slot="mail-settings-card-footer"
                    className="flex min-w-0 flex-col gap-3 rounded-b-xl border-t bg-muted/50 px-5 py-3"
                >
                    <MailTestForm
                        defaultRecipient={defaultRecipient}
                        lastTest={lastTest}
                        dirty={dirty}
                        delivering={mail.delivering}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'Every change is recorded in the audit log and mailed to every instance admin.',
                        )}
                    </p>
                </div>
            </Card>
            {barSlot !== null &&
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
