import { Check, ChevronsUpDown, CircleAlert, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type SelectOption = {
    value: string;
    label: string;
    group?: string;
    disabled?: boolean;
    icon?: ReactNode;
};

export type SelectFieldProps = {
    label: string;
    options: SelectOption[];
    value?: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    id?: string;
    className?: string;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export type ComboboxProps = Omit<SelectFieldProps, 'placeholder'> & {
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    onCreate?: (query: string) => void;
    renderOption?: (option: SelectOption) => ReactNode;
};

type OptionGroup = { heading: string | null; options: SelectOption[] };

export function groupOptions(options: SelectOption[]): OptionGroup[] {
    const groups: OptionGroup[] = [];

    options.forEach((option) => {
        const heading = option.group ?? null;
        const existing = groups.find((group) => group.heading === heading);

        if (existing) {
            existing.options.push(option);

            return;
        }

        groups.push({ heading, options: [option] });
    });

    return groups.sort(
        (a, b) => Number(a.heading !== null) - Number(b.heading !== null),
    );
}

function fold(text: string): string {
    return Array.from(text)
        .map((char) => char.normalize('NFD').replace(/\p{M}/gu, '')[0] ?? char)
        .join('')
        .toLowerCase();
}

function matchesQuery(
    _value: string,
    search: string,
    keywords?: string[],
): number {
    const needle = fold(search.trim());

    return needle === '' || fold(keywords?.[0] ?? '').includes(needle) ? 1 : 0;
}

export function highlightMatch(label: string, query: string): ReactNode {
    const needle = fold(query.trim());

    if (needle === '') {
        return label;
    }

    const start = fold(label).indexOf(needle);

    if (start === -1) {
        return label;
    }

    const end = start + needle.length;

    return (
        <>
            {label.slice(0, start)}
            <mark className="bg-transparent font-bold text-skrum-primary-text">
                {label.slice(start, end)}
            </mark>
            {label.slice(end)}
        </>
    );
}

function FieldShell({
    label,
    fieldId,
    error,
    disabled,
    className,
    children,
}: {
    label: string;
    fieldId: string;
    error?: string;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            data-slot="select-field"
            className={cn('flex min-w-0 flex-col gap-1.5', className)}
        >
            <Label htmlFor={fieldId} className={cn(disabled && 'opacity-55')}>
                <span className="truncate">{label}</span>
            </Label>
            {children}
            {error && (
                <span
                    id={`${fieldId}-error`}
                    data-slot="field-error"
                    className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
                >
                    <CircleAlert
                        className="size-4 shrink-0"
                        aria-hidden="true"
                    />
                    {error}
                </span>
            )}
        </div>
    );
}

function OptionContent({ option }: { option: SelectOption }) {
    return (
        <>
            {option.icon}
            <span className="truncate">{option.label}</span>
        </>
    );
}

export function SelectField({
    label,
    options,
    value,
    onValueChange,
    placeholder,
    error,
    disabled,
    id,
    className,
    defaultOpen,
    open,
    onOpenChange,
}: SelectFieldProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
        <FieldShell
            label={label}
            fieldId={fieldId}
            error={error}
            disabled={disabled}
            className={className}
        >
            <Select
                value={value ?? ''}
                onValueChange={onValueChange}
                disabled={disabled}
                defaultOpen={defaultOpen}
                open={open}
                onOpenChange={onOpenChange}
            >
                <SelectTrigger
                    id={fieldId}
                    className="w-full"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${fieldId}-error` : undefined}
                >
                    <SelectValue
                        placeholder={placeholder ?? t('Select an option')}
                    />
                </SelectTrigger>
                <SelectContent>
                    {groupOptions(options).map((group, index) => {
                        const items = group.options.map((option) => (
                            <SelectItem
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                            >
                                <OptionContent option={option} />
                            </SelectItem>
                        ));

                        if (group.heading === null) {
                            return items;
                        }

                        return (
                            <SelectGroup key={`${group.heading}-${index}`}>
                                <SelectLabel>{group.heading}</SelectLabel>
                                {items}
                            </SelectGroup>
                        );
                    })}
                </SelectContent>
            </Select>
        </FieldShell>
    );
}

export function Combobox({
    label,
    options,
    value,
    onValueChange,
    placeholder,
    searchPlaceholder,
    emptyText,
    onCreate,
    renderOption,
    error,
    disabled,
    id,
    className,
    defaultOpen,
    open: controlledOpen,
    onOpenChange,
}: ComboboxProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const listId = `${fieldId}-list`;
    const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
    const open = controlledOpen ?? internalOpen;
    const [query, setQuery] = useState('');
    const selected = options.find((option) => option.value === value);

    const handleOpenChange = (next: boolean): void => {
        setInternalOpen(next);
        onOpenChange?.(next);
        setQuery('');
    };

    const choose = (next: string): void => {
        onValueChange(next);
        handleOpenChange(false);
    };

    const trimmedQuery = query.trim();

    return (
        <FieldShell
            label={label}
            fieldId={fieldId}
            error={error}
            disabled={disabled}
            className={className}
        >
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <button
                        id={fieldId}
                        type="button"
                        role="combobox"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-controls={open ? listId : undefined}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={
                            error ? `${fieldId}-error` : undefined
                        }
                        disabled={disabled}
                        data-slot="combobox-trigger"
                        data-placeholder={selected ? undefined : ''}
                        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            {selected ? (
                                <OptionContent option={selected} />
                            ) : (
                                <span className="truncate">
                                    {placeholder ?? t('Select an option')}
                                </span>
                            )}
                        </span>
                        <ChevronsUpDown
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-48 overflow-hidden rounded-lg p-0 shadow-popover"
                >
                    <Command defaultValue={value} filter={matchesQuery}>
                        <CommandInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder={searchPlaceholder ?? t('Search…')}
                        />
                        <CommandList id={listId}>
                            <CommandEmpty>
                                <span className="block truncate px-2">
                                    {emptyText ?? t('No results found.')}
                                </span>
                                {onCreate && trimmedQuery !== '' && (
                                    <button
                                        type="button"
                                        data-slot="combobox-create"
                                        onClick={() => {
                                            onCreate(trimmedQuery);
                                            handleOpenChange(false);
                                        }}
                                        className="mx-auto mt-2 flex max-w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-skrum-primary-text outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Plus
                                            className="size-4 shrink-0"
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">
                                            {t('Create “:query”', {
                                                query: trimmedQuery,
                                            })}
                                        </span>
                                    </button>
                                )}
                            </CommandEmpty>
                            {groupOptions(options).map((group, index) => (
                                <CommandGroup
                                    key={`${group.heading ?? ''}-${index}`}
                                    heading={group.heading ?? undefined}
                                >
                                    {group.options.map((option) => (
                                        <CommandItem
                                            key={option.value}
                                            value={option.value}
                                            keywords={[option.label]}
                                            disabled={option.disabled}
                                            onSelect={() =>
                                                choose(option.value)
                                            }
                                        >
                                            {renderOption ? (
                                                renderOption(option)
                                            ) : (
                                                <>
                                                    {option.icon}
                                                    <span className="truncate">
                                                        {highlightMatch(
                                                            option.label,
                                                            query,
                                                        )}
                                                    </span>
                                                </>
                                            )}
                                            {option.value === value && (
                                                <Check
                                                    className="ml-auto size-4 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </FieldShell>
    );
}
