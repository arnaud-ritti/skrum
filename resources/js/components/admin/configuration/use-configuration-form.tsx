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
    /** The server stored the section. */
    onSaved?: () => void;
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

function isBlank(value: ConfigurationValue): boolean {
    if (value === null) {
        return true;
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    return typeof value === 'string' && value.trim() === '';
}

/**
 * The changed values, the typed secrets and the fields to clear, as the server reads them.
 * The server skips a blank value, so a blank stored value becomes a clear and any other is not sent.
 */
function payload(
    fields: ConfigurationFields,
    initial: ConfigurationFormData,
    current: ConfigurationFormData,
): ConfigurationPayload {
    const sent: ConfigurationPayload = {};
    const clear = [...current.clear];

    for (const [name, value] of Object.entries(current.values)) {
        if (clear.includes(name)) {
            continue;
        }

        if (sameValue(value, initial.values[name] ?? null)) {
            continue;
        }

        if (isBlank(value)) {
            if (fields[name]?.source === 'stored') {
                clear.push(name);
            }

            continue;
        }

        sent[name] = value;
    }

    for (const [name, secret] of Object.entries(current.secrets)) {
        if (clear.includes(name)) {
            continue;
        }

        if (secret.trim() === '') {
            continue;
        }

        sent[name] = secret;
    }

    if (clear.length > 0) {
        sent.clear = clear;
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
    { onConfirmationRefused, onSaved }: UseConfigurationFormOptions = {},
): ConfigurationForm {
    const initial = initialData(fields);
    const form = useForm<ConfigurationFormData>(initial);
    const { data } = form;
    const changes = payload(fields, initial, data);
    const dirtyCount = Object.entries(changes).reduce(
        (count, [name, change]) =>
            name === 'clear' && Array.isArray(change)
                ? count + change.length
                : count + 1,
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

        form.transform((current) => payload(fields, initial, current));
        form.put(updateUrl, {
            preserveScroll: true,
            onSuccess: () => {
                /* The page keeps its state: an unchanged answer must not leave a typed secret behind (rule S5). */
                const saved: ConfigurationFormData = {
                    values: data.values,
                    secrets: emptySecrets(data.secrets),
                    clear: [],
                };

                form.setDefaults(saved);
                form.setData(saved);
                form.clearErrors();
                onSaved?.();
            },
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
