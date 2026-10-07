import { Head } from '@inertiajs/react';
import { useId } from 'react';
import LlmSettingsController from '@/actions/App/Http/Controllers/Admin/LlmSettingsController';
import { create as confirm } from '@/routes/admin/aiConfirmation';
import { AdminShell } from '@/components/admin/admin-shell';
import { UnsavedBar } from '@/components/admin/branding/unsaved-bar';
import {
    ConfirmationLine,
    useFreshConfirmation,
} from '@/components/admin/configuration/confirmation-line';
import { ConfigurationField } from '@/components/admin/configuration/configuration-field';
import { SecretField } from '@/components/admin/configuration/secret-field';
import { useConfigurationForm } from '@/components/admin/configuration/use-configuration-form';
import { SettingsCard } from '@/components/settings/settings-card';
import { useTrans } from '@/hooks/use-trans';
import type { ConfigurationFields } from '@/lib/admin/types';

export type AiSettingsProps = {
    fields: ConfigurationFields;
    configured: boolean;
    confirmedUntil: string | null;
};

function AiSettingsForm({
    fields,
    configured,
    confirmedUntil,
}: AiSettingsProps) {
    const { t } = useTrans();
    const formId = useId();
    const { needsConfirmation, refuse } = useFreshConfirmation(confirmedUntil);
    const form = useConfigurationForm(
        fields,
        LlmSettingsController.update.url(),
        { onConfirmationRefused: refuse },
    );
    const labels: Record<string, string> = {
        provider: t('Provider'),
        key: t('API key'),
        model: t('Model'),
        base_url: t('Base URL'),
    };

    return (
        <AdminShell
            active="ai"
            actions={
                <UnsavedBar
                    count={form.dirtyCount}
                    saving={form.processing}
                    canSave={!needsConfirmation}
                    onCancel={form.reset}
                    form={formId}
                />
            }
        >
            <Head title={t('AI')} />
            <div className="flex max-w-3xl min-w-0 flex-col gap-8">
                <ConfirmationLine
                    visible={needsConfirmation}
                    confirmUrl={confirm.url()}
                />
                <SettingsCard
                    title={t('AI')}
                    description={t(
                        'Configure the language model used for survey drafts, group names and retrospective summaries.',
                    )}
                >
                    <p className="text-body-sm text-muted-foreground">
                        {configured ? t('Configured') : t('Not configured')}
                    </p>
                    <form
                        id={formId}
                        aria-label={t('AI settings')}
                        className="flex min-w-0 flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!needsConfirmation && form.dirtyCount > 0) {
                                void form.submit();
                            }
                        }}
                    >
                        <p className="text-body-sm text-muted-foreground">
                            {t(
                                'Use anthropic or openai as the provider. Provider, API key and model are required to enable AI. The base URL is optional; use openai for an OpenAI-compatible server. Mistral, Gemini, Ollama and compatible Bedrock endpoints use openai with their base URL; Bedrock requires a bearer API key.',
                            )}
                        </p>
                        {Object.entries(fields).map(([name, description]) => {
                            const Field = description.secret
                                ? SecretField
                                : ConfigurationField;
                            return (
                                <Field
                                    key={name}
                                    name={name}
                                    label={labels[name] ?? name}
                                    description={description}
                                    value={String(form.value(name) ?? '')}
                                    onChange={(value) =>
                                        form.setValue(name, value)
                                    }
                                    clearing={form.isClearing(name)}
                                    onClearingChange={(clearing) =>
                                        form.setClearing(name, clearing)
                                    }
                                    readOnly={
                                        needsConfirmation || form.processing
                                    }
                                    error={form.errors[name]}
                                />
                            );
                        })}
                        {form.errors.section && (
                            <p
                                role="alert"
                                className="text-body-sm text-skrum-destructive-text"
                            >
                                {form.errors.section}
                            </p>
                        )}
                        <p className="text-body-sm text-muted-foreground">
                            {t(
                                'Content submitted to AI is sent to this provider. Stored settings override the environment; clearing a field restores its environment value.',
                            )}
                        </p>
                    </form>
                </SettingsCard>
            </div>
        </AdminShell>
    );
}

export default function AdminAi(props: AiSettingsProps) {
    return <AiSettingsForm key={JSON.stringify(props.fields)} {...props} />;
}
