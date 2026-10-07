import { useForm } from '@inertiajs/react';
import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';
import GeneralSettingsController from '@/actions/App/Http/Controllers/Admin/GeneralSettingsController';
import { SettingsCard } from '@/components/settings/settings-card';
import { RadioGroup } from '@/components/ui/radio-group';
import { UnsavedBar } from '@/components/admin/branding/unsaved-bar';
import { useTrans } from '@/hooks/use-trans';
import type { GeneralSettingsPageProps, SignupMode } from '@/lib/admin/types';
import { SignupCard } from './signup-card';
import { UpdatesCard } from './updates-card';

type GeneralFormData = {
    require_email_verification: boolean | null;
    signup_mode: SignupMode;
    allowed_email_domains: string[];
    update_check_enabled: boolean;
};

type GeneralPayload = {
    require_email_verification?: boolean | null;
    signup_mode?: SignupMode;
    allowed_email_domains?: string[];
    update_check_enabled?: boolean;
};

type GeneralSettingsFormProps = GeneralSettingsPageProps & {
    /**
     * Places the unsaved-changes bar and the form: the page hands the bar to
     * the topbar. Without it the bar sits above the form.
     */
    frame?: (bar: ReactNode, content: ReactNode) => ReactNode;
};

function stacked(bar: ReactNode, content: ReactNode): ReactNode {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex justify-end">{bar}</div>
            {content}
        </div>
    );
}

function initialData(props: GeneralSettingsPageProps): GeneralFormData {
    return {
        require_email_verification: props.requireEmailVerification,
        signup_mode: props.signupMode ?? props.defaults.signupMode,
        allowed_email_domains:
            props.allowedEmailDomains ?? props.defaults.allowedEmailDomains,
        update_check_enabled: props.updateCheckEnabled,
    };
}

/** The fields that differ from what the page was given, as the server reads them. */
function changedFields(
    initial: GeneralFormData,
    current: GeneralFormData,
): GeneralPayload {
    const payload: GeneralPayload = {};

    if (
        current.require_email_verification !==
        initial.require_email_verification
    ) {
        payload.require_email_verification = current.require_email_verification;
    }

    if (current.signup_mode !== initial.signup_mode) {
        payload.signup_mode = current.signup_mode;
    }

    if (
        current.allowed_email_domains.join('\n') !==
        initial.allowed_email_domains.join('\n')
    ) {
        payload.allowed_email_domains = current.allowed_email_domains;
    }

    if (current.update_check_enabled !== initial.update_check_enabled) {
        payload.update_check_enabled = current.update_check_enabled;
    }

    return payload;
}

/** The first refusal of the domain list or of one of its domains. */
function domainsError(errors: Record<string, string>): string | undefined {
    const key = Object.keys(errors).find(
        (name) =>
            name === 'allowed_email_domains' ||
            name.startsWith('allowed_email_domains.'),
    );

    return key === undefined ? undefined : errors[key];
}

export function GeneralSettingsForm({
    frame = stacked,
    ...props
}: GeneralSettingsFormProps) {
    const { t } = useTrans();
    const formId = useId();
    const initial = initialData(props);
    const form = useForm<GeneralFormData>(initial);
    const { data } = form;
    const errors = form.errors as Record<string, string>;
    const changes = Object.keys(changedFields(initial, data)).length;
    const missingDomain =
        data.signup_mode === 'domain' &&
        data.allowed_email_domains.length === 0;
    const canSave = !missingDomain;

    function save(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        if (changes === 0 || !canSave || form.processing) {
            return;
        }

        form.transform((current) => changedFields(initial, current));
        form.put(GeneralSettingsController.update.url(), {
            preserveScroll: true,
        });
    }

    function cancel(): void {
        form.reset();
        form.clearErrors();
    }

    const bar = (
        <UnsavedBar
            count={changes}
            saving={form.processing}
            canSave={canSave}
            onCancel={cancel}
            form={formId}
        />
    );

    const content = (
        <form
            id={formId}
            onSubmit={save}
            aria-label={t('General')}
            data-slot="general-settings-form"
            className="flex min-w-0 flex-col gap-8"
        >
            <SignupCard
                mode={data.signup_mode}
                domains={data.allowed_email_domains}
                defaults={props.defaults}
                onModeChange={(mode) => {
                    form.setData('signup_mode', mode);
                    form.clearErrors('signup_mode');
                }}
                onDomainsChange={(domains) => {
                    form.setData('allowed_email_domains', domains);
                    form.clearErrors(
                        ...(Object.keys(errors).filter((name) =>
                            name.startsWith('allowed_email_domains'),
                        ) as `allowed_email_domains.${number}`[]),
                    );
                }}
                modeError={errors.signup_mode}
                error={
                    domainsError(errors) ??
                    (missingDomain ? t('Add at least one domain.') : undefined)
                }
            />
            <SettingsCard
                title={t('Email verification')}
                description={t(
                    'Require members to verify their email before using the instance.',
                )}
            >
                <RadioGroup
                    aria-label={t('Email verification')}
                    value={
                        data.require_email_verification === null
                            ? 'environment'
                            : data.require_email_verification
                              ? 'required'
                              : 'optional'
                    }
                    onValueChange={(value) => {
                        form.setData(
                            'require_email_verification',
                            value === 'environment'
                                ? null
                                : value === 'required',
                        );
                        form.clearErrors('require_email_verification');
                    }}
                    options={[
                        {
                            value: 'environment',
                            label: t('Use environment default'),
                            description: props.defaults.requireEmailVerification
                                ? t('Required')
                                : t('Optional'),
                        },
                        { value: 'required', label: t('Required') },
                        { value: 'optional', label: t('Optional') },
                    ]}
                />
                {errors.require_email_verification && (
                    <p
                        role="alert"
                        className="text-body-sm text-skrum-destructive-text"
                    >
                        {errors.require_email_verification}
                    </p>
                )}
            </SettingsCard>
            <UpdatesCard
                version={props.version}
                image={props.image}
                status={props.versionStatus}
                enabled={data.update_check_enabled}
                onEnabledChange={(enabled) =>
                    form.setData('update_check_enabled', enabled)
                }
                error={errors.update_check_enabled}
            />
        </form>
    );

    return frame(bar, content);
}
