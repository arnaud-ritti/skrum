import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { ConfigurationFieldDescription } from '@/lib/admin/types';
import { cn } from '@/lib/utils';

export type ConfigurationFieldBaseProps = {
    name: string;
    label: string;
    description: ConfigurationFieldDescription;
    value: string;
    onChange: (value: string) => void;
    /** Marked to return to the environment value on save (rule S7). */
    clearing: boolean;
    onClearingChange: (clearing: boolean) => void;
    /** Without a fresh confirmation (rule S2), or while another card is edited. */
    readOnly?: boolean;
    /** Not used by the settings as they stand (SMTP fields while mails go to the log). */
    disabled?: boolean;
    error?: string;
    className?: string;
    options?: { value: string; label: string }[];
};

type FieldNotesProps = {
    /** The source line or the secret's help line; nothing for an empty field. */
    hint: ReactNode;
    /** The field holds a value saved here (or one that can no longer be read). */
    clearable: boolean;
    clearing: boolean;
    onClearingChange: (clearing: boolean) => void;
    readOnly: boolean;
    hintId: string;
    error?: string;
    errorId: string;
};

/** What sits under a configuration field: its source, the way back to the environment, the server's refusal. */
export function FieldNotes({
    hint,
    clearable,
    clearing,
    onClearingChange,
    readOnly,
    hintId,
    error,
    errorId,
}: FieldNotesProps) {
    const { t } = useTrans();

    return (
        <>
            {(clearing || hint !== null || clearable) && (
                <p
                    id={hintId}
                    data-slot="configuration-field-hint"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body-sm text-muted-foreground"
                >
                    {clearing ? (
                        <>
                            <span className="min-w-0 font-medium text-skrum-warning-text">
                                {t(
                                    'Back to the environment value when you save.',
                                )}
                            </span>
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-body-sm"
                                onClick={() => onClearingChange(false)}
                            >
                                {t('Undo')}
                            </Button>
                        </>
                    ) : (
                        <>
                            {hint !== null && (
                                <span className="min-w-0">{hint}</span>
                            )}
                            {clearable && (
                                <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-body-sm"
                                    disabled={readOnly}
                                    onClick={() => onClearingChange(true)}
                                >
                                    {t('Use the environment value')}
                                </Button>
                            )}
                        </>
                    )}
                </p>
            )}
            {error !== undefined && (
                <p
                    id={errorId}
                    role="alert"
                    data-slot="field-error"
                    className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                >
                    <CircleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0">{error}</span>
                </p>
            )}
        </>
    );
}

export function useFieldIds(name: string) {
    const id = useId();

    return {
        inputId: `${id}-${name}`,
        hintId: `${id}-${name}-hint`,
        errorId: `${id}-${name}-error`,
    };
}

/** The source line of a non-secret field: saved here, from the environment, or nothing. */
export function useSourceHint(
    description: ConfigurationFieldDescription,
): string | null {
    const { t } = useTrans();
    const hints: Record<
        ConfigurationFieldDescription['source'],
        string | null
    > = {
        stored: t('Saved here'),
        environment: t('From the environment (:env)', {
            env: description.envName,
        }),
        none: null,
    };

    return hints[description.source];
}

export function describedBy(
    ...ids: (string | false | undefined)[]
): string | undefined {
    const joined = ids.filter((id) => typeof id === 'string').join(' ');

    return joined === '' ? undefined : joined;
}

/** A non-secret field of a configuration section, with its source under it. */
export function ConfigurationField({
    name,
    label,
    description,
    value,
    onChange,
    clearing,
    onClearingChange,
    readOnly = false,
    disabled = false,
    error,
    className,
    options,
}: ConfigurationFieldBaseProps) {
    const { inputId, hintId, errorId } = useFieldIds(name);
    const hint = useSourceHint(description);
    const clearable = description.source === 'stored';

    return (
        <div
            data-slot="configuration-field"
            data-source={description.source}
            className={cn('flex min-w-0 flex-col gap-1.5', className)}
        >
            <Label htmlFor={inputId}>{label}</Label>
            {options ? (
                <Select
                    value={value || undefined}
                    onValueChange={onChange}
                    disabled={readOnly || clearing || disabled}
                >
                    <SelectTrigger
                        id={inputId}
                        className="w-full"
                        aria-invalid={error !== undefined ? true : undefined}
                        aria-describedby={describedBy(
                            (clearing || hint !== null || clearable) && hintId,
                            error !== undefined && errorId,
                        )}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <Input
                    id={inputId}
                    name={name}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    readOnly={readOnly || clearing}
                    disabled={disabled}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    aria-invalid={error !== undefined ? true : undefined}
                    aria-describedby={describedBy(
                        (clearing || hint !== null || clearable) && hintId,
                        error !== undefined && errorId,
                    )}
                />
            )}
            <FieldNotes
                hint={hint}
                clearable={clearable}
                clearing={clearing}
                onClearingChange={onClearingChange}
                readOnly={readOnly || disabled}
                hintId={hintId}
                error={error}
                errorId={errorId}
            />
        </div>
    );
}
