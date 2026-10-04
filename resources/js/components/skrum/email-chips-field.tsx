import { CircleAlert, X } from 'lucide-react';
import { useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { addChips, removeChip } from '@/lib/invitations/email-chips';
import type { EmailChip } from '@/lib/invitations/email-chips';
import { cn } from '@/lib/utils';

const ChipKeys = ['Enter', ',', ';', ' '];

type FieldError = { key: string; text: string };

/**
 * Several addresses as chips (`.ob-chips` of the mockup): typed text becomes
 * a chip on Enter, a comma, a space, a paste or when the field is left.
 * `errors` are the server's, keyed `emails` and `emails.<index of the chip>`.
 */
export function EmailChipsField({
    id,
    label,
    chips,
    onChange,
    errors = {},
    disabled,
}: {
    id: string;
    label: string;
    chips: EmailChip[];
    onChange: (chips: EmailChip[]) => void;
    errors?: Record<string, string | undefined>;
    disabled?: boolean;
}) {
    const { t } = useTrans();
    const [draft, setDraft] = useState('');
    const errorId = `${id}-error`;

    const commit = (text: string): void => {
        setDraft('');

        if (text.trim() === '') {
            return;
        }

        onChange(addChips(chips, text));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (ChipKeys.includes(event.key)) {
            if (event.key === 'Enter' && draft.trim() === '') {
                return;
            }

            event.preventDefault();
            commit(draft);

            return;
        }

        if (event.key === 'Backspace' && draft === '' && chips.length > 0) {
            event.preventDefault();
            onChange(chips.slice(0, -1));
        }
    };

    const handlePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
        event.preventDefault();
        commit(`${draft} ${event.clipboardData.getData('text')}`);
    };

    const chipError = (index: number): string | undefined =>
        errors[`emails.${index}`];

    const messages: FieldError[] = [
        ...(errors.emails === undefined
            ? []
            : [{ key: 'emails', text: errors.emails }]),
        ...chips.flatMap((chip, index): FieldError[] => {
            const serverError = chipError(index);

            if (serverError !== undefined) {
                return [
                    {
                        key: chip.value,
                        text: serverError.includes(chip.value)
                            ? serverError
                            : `${chip.value} · ${serverError}`,
                    },
                ];
            }

            if (!chip.isValid) {
                return [
                    {
                        key: chip.value,
                        text: t('“:address” looks incomplete.', {
                            address: chip.value,
                        }),
                    },
                ];
            }

            return [];
        }),
    ];
    const isInvalid = messages.length > 0;

    return (
        <div
            data-slot="email-chips-field"
            className="flex min-w-0 flex-col gap-1.5"
        >
            <Label htmlFor={id} className={cn(disabled && 'opacity-55')}>
                {label}
            </Label>
            <div
                data-invalid={isInvalid ? '' : undefined}
                className={cn(
                    'flex min-h-9 min-w-0 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card p-1.5 shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
                    isInvalid &&
                        'border-destructive focus-within:border-destructive focus-within:ring-destructive',
                    disabled && 'opacity-55',
                )}
            >
                {chips.length > 0 && (
                    <ul className="contents">
                        {chips.map((chip, index) => {
                            const isBad =
                                !chip.isValid || chipError(index) !== undefined;

                            return (
                                <li
                                    key={chip.value}
                                    data-value={chip.value}
                                    aria-invalid={isBad ? true : undefined}
                                    className={cn(
                                        'inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-sm bg-muted pr-1 pl-2 text-body-sm',
                                        isBad &&
                                            'bg-skrum-destructive-soft text-skrum-destructive-text inset-ring inset-ring-skrum-destructive-text/35',
                                    )}
                                >
                                    <span className="truncate">
                                        {chip.value}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        aria-label={t('Remove :name', {
                                            name: chip.value,
                                        })}
                                        onClick={() =>
                                            onChange(
                                                removeChip(chips, chip.value),
                                            )
                                        }
                                        className={cn(
                                            'grid size-4 shrink-0 place-items-center rounded-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                                            isBad && 'text-inherit',
                                        )}
                                    >
                                        <X
                                            aria-hidden="true"
                                            className="size-3.5"
                                        />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <input
                    id={id}
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    value={draft}
                    disabled={disabled}
                    aria-invalid={isInvalid ? true : undefined}
                    aria-describedby={isInvalid ? errorId : undefined}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onBlur={() => commit(draft)}
                    className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                />
            </div>
            <div
                id={errorId}
                aria-live="polite"
                className="flex flex-col gap-1"
            >
                {messages.map((message) => (
                    <span
                        key={message.key}
                        data-slot="field-error"
                        className="flex items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                    >
                        <CircleAlert
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                        />
                        <span className="min-w-0 wrap-anywhere">
                            {message.text}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}
