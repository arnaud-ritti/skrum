import { ChevronsUpDown, CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { CandidateQueryMinLength } from '@/components/admin/admins/types';
import type {
    AdminCandidate,
    CandidateSearchStatus,
} from '@/components/admin/admins/types';
import { PersonAvatar } from '@/components/ui/avatar';
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    useCommandListId,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';

type CandidateComboboxProps = {
    label: string;
    query: string;
    onQueryChange: (query: string) => void;
    candidates: AdminCandidate[];
    status: CandidateSearchStatus;
    value: AdminCandidate | null;
    onValueChange: (candidate: AdminCandidate) => void;
    error?: string;
    disabled?: boolean;
    defaultOpen?: boolean;
};

function CandidateLine({ candidate }: { candidate: AdminCandidate }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <PersonAvatar
                decorative
                name={candidate.name}
                src={candidate.avatarUrl}
                size="sm"
                className="shrink-0"
            />
            <span className="truncate font-medium">{candidate.name}</span>
            <span className="truncate text-muted-foreground">
                {candidate.email}
            </span>
        </span>
    );
}

function ListMessage({ children }: { children: ReactNode }) {
    return (
        <p
            role="status"
            data-slot="candidate-status"
            className="flex items-center justify-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground"
        >
            {children}
        </p>
    );
}

export function CandidateCombobox({
    label,
    query,
    onQueryChange,
    candidates,
    status,
    value,
    onValueChange,
    error,
    disabled,
    defaultOpen = false,
}: CandidateComboboxProps) {
    const { t } = useTrans();
    const fieldId = useId();
    const [listId, listRef] = useCommandListId();
    const [open, setOpen] = useState(defaultOpen);
    const tooShort = query.trim().length < CandidateQueryMinLength;

    const choose = (candidate: AdminCandidate): void => {
        onValueChange(candidate);
        setOpen(false);
    };

    return (
        <div
            data-slot="candidate-combobox"
            className="flex min-w-0 flex-col gap-1.5"
        >
            <Label htmlFor={fieldId}>
                <span className="truncate">{label}</span>
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
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
                        data-placeholder={value ? undefined : ''}
                        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[placeholder]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
                    >
                        {value ? (
                            <CandidateLine candidate={value} />
                        ) : (
                            <span className="truncate">
                                {t('Search a member by name or email')}
                            </span>
                        )}
                        <ChevronsUpDown
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    aria-label={label}
                    className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-48 overflow-hidden rounded-lg p-0 shadow-popover"
                >
                    <Command shouldFilter={false}>
                        <CommandInput
                            value={query}
                            onValueChange={onQueryChange}
                            placeholder={t('Search…')}
                        />
                        <CommandList ref={listRef}>
                            {tooShort && (
                                <ListMessage>
                                    {t(
                                        'Type at least :count characters to search.',
                                        { count: CandidateQueryMinLength },
                                    )}
                                </ListMessage>
                            )}
                            {!tooShort && status === 'loading' && (
                                <ListMessage>
                                    <Spinner aria-hidden="true" />
                                    {t('Searching…')}
                                </ListMessage>
                            )}
                            {!tooShort && status === 'error' && (
                                <ListMessage>
                                    {t(
                                        'The search is unavailable. Try again in a moment.',
                                    )}
                                </ListMessage>
                            )}
                            {!tooShort &&
                                status === 'ready' &&
                                candidates.length === 0 && (
                                    <ListMessage>
                                        {t('No member matches this search.')}
                                    </ListMessage>
                                )}
                            {!tooShort &&
                                status === 'ready' &&
                                candidates.length > 0 && (
                                    <CommandGroup>
                                        {candidates.map((candidate) => (
                                            <CommandItem
                                                key={candidate.id}
                                                value={candidate.id}
                                                onSelect={() =>
                                                    choose(candidate)
                                                }
                                            >
                                                <CandidateLine
                                                    candidate={candidate}
                                                />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {error && (
                <span
                    id={`${fieldId}-error`}
                    role="alert"
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
