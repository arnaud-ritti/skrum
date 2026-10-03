import { useForm } from '@inertiajs/react';
import type {
    ConfigurationFields,
    ConfigurationValue,
} from '@/lib/admin/types';

type ConfigurationFormData = {
    values: Record<string, ConfigurationValue>;
    /** What the admin typed: a secret is never prefilled (rule S5). */
    secrets: Record<string, string>;
    clear: string[];
};

type ConfigurationPayload = Record<string, ConfigurationValue | string[]>;

type UseConfigurationFormOptions = {
    /** The server asked for a fresh password confirmation (rule S2). */
    onConfirmationRefused?: () => void;
};

export type ConfigurationForm = {
    value: (name: string) => ConfigurationValue;
    setValue: (name: string, value: ConfigurationValue) => void;
    isClearing: (name: string) => boolean;
    setClearing: (name: string, clearing: boolean) => void;
    dirtyCount: number;
    errors: Record<string, string>;
    processing: boolean;
    reset: () => void;
    submit: () => void;
};

function initialData(fields: ConfigurationFields): ConfigurationFormData {
    const data: ConfigurationFormData = { values: {}, secrets: {}, clear: [] };

    for (const [name, field] of Object.entries(fields)) {
        if (field.secret) {
            data.secrets[name] = '';

            continue;
        }

        data.values[name] =
            typeof field.value === 'number'
                ? String(field.value)
                : (field.value ?? '');
    }

    return data;
}

function sameValue(left: ConfigurationValue, right: ConfigurationValue) {
    return JSON.stringify(left) === JSON.stringify(right);
}

/** The changed values, the typed secrets and the fields to clear, as the server reads them. */
function payload(
    initial: ConfigurationFormData,
    current: ConfigurationFormData,
): ConfigurationPayload {
    const sent: ConfigurationPayload = {};

    for (const [name, value] of Object.entries(current.values)) {
        if (current.clear.includes(name)) {
            continue;
        }

        if (sameValue(value, initial.values[name] ?? null)) {
            continue;
        }

        sent[name] = value;
    }

    for (const [name, secret] of Object.entries(current.secrets)) {
        if (current.clear.includes(name)) {
            continue;
        }

        if (secret.trim() === '') {
            continue;
        }

        sent[name] = secret;
    }

    if (current.clear.length > 0) {
        sent.clear = current.clear;
    }

    return sent;
}

function emptySecrets(secrets: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.keys(secrets).map((name) => [name, '']));
}

/**
 * The form of one configuration section (SSO provider, SMTP, integration app):
 * a blank secret keeps the stored one (rule S6), a refused save never keeps a
 * typed secret in the browser.
 */
export function useConfigurationForm(
    fields: ConfigurationFields,
    updateUrl: string,
    { onConfirmationRefused }: UseConfigurationFormOptions = {},
): ConfigurationForm {
    const initial = initialData(fields);
    const form = useForm<ConfigurationFormData>(initial);
    const { data } = form;
    const dirtyCount = Object.keys(payload(initial, data)).reduce(
        (count, name) =>
            name === 'clear' ? count + data.clear.length : count + 1,
        0,
    );

    function value(name: string): ConfigurationValue {
        if (name in data.secrets) {
            return data.secrets[name];
        }

        return data.values[name] ?? '';
    }

    function setValue(name: string, next: ConfigurationValue): void {
        if (name in data.secrets) {
            form.setData('secrets', {
                ...data.secrets,
                [name]: String(next ?? ''),
            });

            return;
        }

        form.setData('values', { ...data.values, [name]: next });
    }

    function setClearing(name: string, clearing: boolean): void {
        const others = data.clear.filter((cleared) => cleared !== name);

        form.setData('clear', clearing ? [...others, name] : others);
    }

    function reset(): void {
        form.reset();
        form.clearErrors();
    }

    function submit(): void {
        if (form.processing) {
            return;
        }

        form.transform((current) => payload(initial, current));
        form.put(updateUrl, {
            preserveScroll: true,
            onError: (errors) => {
                form.setData('secrets', emptySecrets(data.secrets));

                if ('confirmation' in errors) {
                    onConfirmationRefused?.();
                }
            },
        });
    }

    return {
        value,
        setValue,
        isClearing: (name) => data.clear.includes(name),
        setClearing,
        dirtyCount,
        errors: form.errors as Record<string, string>,
        processing: form.processing,
        reset,
        submit,
    };
}
