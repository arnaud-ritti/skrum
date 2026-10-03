import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { describedBy, FieldNotes, useFieldIds } from './configuration-field';
import type { ConfigurationFieldBaseProps } from './configuration-field';

/** The mockup's masked dots: a placeholder, never the stored secret (rule S5). */
export const SecretPlaceholder = '••••••••••••••••••';

type SecretFieldProps = ConfigurationFieldBaseProps & {
    /** A pasted key (the GitHub App's private key): a text area, no eye. */
    multiline?: boolean;
};

/**
 * A write-only secret: always empty, a blank one keeps what is stored (rule S6).
 * The eye shows only what the admin typed; no stored secret reaches the browser.
 */
export function SecretField({
    name,
    label,
    description,
    value,
    onChange,
    clearing,
    onClearingChange,
    readOnly = false,
    error,
    className,
    multiline = false,
}: SecretFieldProps) {
    const { t } = useTrans();
    const { inputId, hintId, errorId } = useFieldIds(name);
    const [shown, setShown] = useState(false);
    const isEmpty = value === '';
    const visible = shown && !isEmpty;
    const helps: Record<
        ConfigurationFieldBaseProps['description']['source'],
        string | null
    > = {
        stored: t('Saved. Leave blank to keep it.'),
        environment: t(
            'From the environment (:env). Type a value to save one here.',
            { env: description.envName },
        ),
        none: null,
    };
    const hint = description.secretSet ? helps[description.source] : null;
    const clearable = description.source === 'stored' || description.unreadable;
    const placeholder = description.secretSet ? SecretPlaceholder : undefined;
    const fieldProps = {
        id: inputId,
        name,
        value,
        placeholder,
        readOnly: readOnly || clearing,
        autoComplete: 'new-password',
        spellCheck: false,
        'aria-invalid': error !== undefined ? true : undefined,
        'aria-describedby': describedBy(
            (clearing || hint !== null || clearable) && hintId,
            error !== undefined && errorId,
        ),
    } as const;

    return (
        <div
            data-slot="secret-field"
            data-source={description.source}
            className={cn('flex min-w-0 flex-col gap-1.5', className)}
        >
            <Label htmlFor={inputId}>{label}</Label>
            {description.unreadable && (
                <Alert
                    variant="warning"
                    title={t(
                        "A saved secret can't be read any more (the application key changed). Enter it again.",
                    )}
                />
            )}
            {multiline ? (
                <Textarea
                    {...fieldProps}
                    rows={4}
                    onChange={(event) => onChange(event.target.value)}
                    className="font-mono"
                />
            ) : (
                <div className="relative min-w-0">
                    <Input
                        {...fieldProps}
                        type={visible ? 'text' : 'password'}
                        onChange={(event) => onChange(event.target.value)}
                        className="pr-10 font-mono"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isEmpty}
                        aria-pressed={visible}
                        aria-controls={inputId}
                        aria-label={
                            visible
                                ? t('Hide what you typed')
                                : t('Show what you typed')
                        }
                        onClick={() => setShown(!visible)}
                        className="absolute inset-y-0.5 right-0.5 h-auto text-muted-foreground"
                    >
                        {visible ? (
                            <EyeOff aria-hidden="true" />
                        ) : (
                            <Eye aria-hidden="true" />
                        )}
                    </Button>
                </div>
            )}
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
