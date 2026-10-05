import { CircleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type {
    ChangeEvent,
    ComponentProps,
    KeyboardEvent,
    ReactNode,
} from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const DefaultMaxLength = 280;
const DefaultWarnRatio = 0.9;

type FieldChrome = {
    label: string;
    description?: string;
    error?: string;
    wrapperClassName?: string;
};

export type TextFieldProps = Omit<ComponentProps<'input'>, 'prefix'> &
    FieldChrome & {
        icon?: LucideIcon;
        suffix?: ReactNode;
    };

export type TextareaFieldProps = Omit<ComponentProps<'textarea'>, 'maxLength'> &
    FieldChrome & {
        /** Defaults to 280; null removes the limit and the counter. */
        maxLength?: number | null;
        /** Defaults to 90% of maxLength. */
        warnAt?: number;
        onSubmitShortcut?: () => void;
        /**
         * Called on Escape. That Escape is claimed by the field: a dialog,
         * sheet or popover hosting it stays open (see `claimEscape`).
         */
        onCancel?: () => void;
    };

const claimedEscapes = new WeakSet<Event>();

/**
 * Overlays listen for Escape on `document` in the capture phase, before any
 * React handler runs. Marking the event as handled from `window`, which comes
 * first, is what lets an inline edit be cancelled without closing its host.
 */
export function claimEscape(event: globalThis.KeyboardEvent): void {
    claimedEscapes.add(event);
    event.preventDefault();
}

function describedBy(
    ...ids: Array<string | undefined | false>
): string | undefined {
    const joined = ids.filter(Boolean).join(' ');

    return joined === '' ? undefined : joined;
}

function FieldMessage({
    id,
    description,
    error,
}: {
    id: string;
    description?: string;
    error?: string;
}) {
    if (error) {
        return (
            <span
                id={`${id}-error`}
                data-slot="field-error"
                className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
            >
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                {error}
            </span>
        );
    }

    if (description) {
        return (
            <span
                id={`${id}-description`}
                data-slot="field-description"
                className="text-body-sm text-muted-foreground"
            >
                {description}
            </span>
        );
    }

    return null;
}

export function TextField({
    label,
    description,
    error,
    icon: Icon,
    suffix,
    id,
    className,
    wrapperClassName,
    disabled,
    ...props
}: TextFieldProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
        <div
            data-slot="text-field"
            className={cn('flex min-w-0 flex-col gap-1.5', wrapperClassName)}
        >
            <Label htmlFor={fieldId} className={cn(disabled && 'opacity-55')}>
                {label}
            </Label>
            <div className="relative flex items-center">
                {Icon && (
                    <Icon
                        className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                    />
                )}
                <Input
                    {...props}
                    id={fieldId}
                    disabled={disabled}
                    aria-invalid={error ? true : props['aria-invalid']}
                    aria-describedby={describedBy(
                        props['aria-describedby'],
                        error
                            ? `${fieldId}-error`
                            : description
                              ? `${fieldId}-description`
                              : undefined,
                    )}
                    className={cn(Icon && 'pl-8', suffix && 'pr-10', className)}
                />
                {suffix && (
                    <span className="absolute right-1.5 flex items-center">
                        {suffix}
                    </span>
                )}
            </div>
            <FieldMessage
                id={fieldId}
                description={description}
                error={error}
            />
        </div>
    );
}

export function TextareaField({
    label,
    description,
    error,
    maxLength,
    warnAt,
    onSubmitShortcut,
    onCancel,
    id,
    className,
    wrapperClassName,
    disabled,
    value,
    defaultValue,
    onChange,
    onKeyDown,
    ...props
}: TextareaFieldProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const limit = maxLength === undefined ? DefaultMaxLength : maxLength;
    const [uncontrolledLength, setUncontrolledLength] = useState(
        String(defaultValue ?? '').length,
    );
    const length =
        value === undefined ? uncontrolledLength : String(value).length;
    const threshold =
        limit === null ? null : (warnAt ?? Math.ceil(limit * DefaultWarnRatio));
    const near = threshold !== null && length >= threshold;
    const cancels = onCancel !== undefined;

    useEffect(() => {
        if (!cancels) {
            return;
        }

        const claimOwnEscape = (event: globalThis.KeyboardEvent): void => {
            if (
                event.key === 'Escape' &&
                !event.isComposing &&
                event.target instanceof HTMLElement &&
                event.target.id === fieldId
            ) {
                claimEscape(event);
            }
        };

        const field = document.getElementById(fieldId);

        if (field === null) {
            return;
        }

        const listen = (): void =>
            window.addEventListener('keydown', claimOwnEscape, true);
        const unlisten = (): void =>
            window.removeEventListener('keydown', claimOwnEscape, true);

        field.addEventListener('focusin', listen);
        field.addEventListener('focusout', unlisten);

        if (document.activeElement === field) {
            listen();
        }

        return () => {
            field.removeEventListener('focusin', listen);
            field.removeEventListener('focusout', unlisten);
            unlisten();
        };
    }, [cancels, fieldId]);

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setUncontrolledLength(event.target.value.length);
        onChange?.(event);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        onKeyDown?.(event);

        if (event.nativeEvent.isComposing) {
            return;
        }

        if (event.key === 'Escape' && claimedEscapes.has(event.nativeEvent)) {
            onCancel?.();

            return;
        }

        if (event.defaultPrevented) {
            return;
        }

        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmitShortcut?.();

            return;
        }

        if (event.key === 'Escape') {
            onCancel?.();
        }
    };

    return (
        <div
            data-slot="textarea-field"
            className={cn('flex min-w-0 flex-col gap-1.5', wrapperClassName)}
        >
            <Label htmlFor={fieldId} className={cn(disabled && 'opacity-55')}>
                {label}
            </Label>
            <Textarea
                {...props}
                id={fieldId}
                disabled={disabled}
                {...(value === undefined ? { defaultValue } : { value })}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                aria-invalid={error ? true : props['aria-invalid']}
                aria-describedby={describedBy(
                    props['aria-describedby'],
                    error
                        ? `${fieldId}-error`
                        : description
                          ? `${fieldId}-description`
                          : undefined,
                    limit !== null && `${fieldId}-counter`,
                )}
                className={className}
            />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <FieldMessage
                        id={fieldId}
                        description={description}
                        error={error}
                    />
                </div>
                {limit !== null && (
                    <span
                        id={`${fieldId}-counter`}
                        data-slot="field-counter"
                        data-near={near ? '' : undefined}
                        aria-live={near ? 'polite' : 'off'}
                        className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums data-[near]:font-semibold data-[near]:text-skrum-warning-text"
                    >
                        {`${length}/${limit}`}
                    </span>
                )}
            </div>
        </div>
    );
}
