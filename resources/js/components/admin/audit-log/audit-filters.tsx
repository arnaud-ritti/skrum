import { router } from '@inertiajs/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import AuditEventsController from '@/actions/App/Http/Controllers/Admin/AuditEventsController';
import { PersonAvatar } from '@/components/ui/avatar';
import {
    Command,
    CommandEmpty,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    AuditEvent,
    AuditGroup,
    AuditLogFilters,
} from '@/lib/admin/types';

const AllGroups = 'all';

type Actor = { id: string; name: string; avatarUrl: string | null };

/** The listing's address: the defaults (every group, every actor, page one) stay out of it. */
export function auditEventsUrl(filters: AuditLogFilters, page = 1): string {
    const query: Record<string, string | number> = {};

    if (filters.group !== null) {
        query.group = filters.group;
    }

    if (filters.actor !== null) {
        query.actor = filters.actor;
    }

    if (page > 1) {
        query.page = page;
    }

    return AuditEventsController.index.url({ query });
}

/** The actors of the page that still have an account, once each, by name. */
export function pageActors(events: AuditEvent[]): Actor[] {
    const actors = new Map<string, Actor>();

    for (const { actor } of events) {
        if (actor !== null && actor.id !== null && !actors.has(actor.id)) {
            actors.set(actor.id, { ...actor, id: actor.id });
        }
    }

    return [...actors.values()].sort((first, second) =>
        first.name.localeCompare(second.name),
    );
}

function visit(filters: AuditLogFilters): void {
    router.get(
        auditEventsUrl(filters),
        {},
        { preserveState: true, preserveScroll: true, replace: true },
    );
}

function ActorPicker({
    filters,
    actors,
}: {
    filters: AuditLogFilters;
    actors: Actor[];
}): ReactElement {
    const { t } = useTrans();
    const fieldId = useId();
    const [listId, listRef] = useCommandListId();
    const [open, setOpen] = useState(false);
    const selected = actors.find((actor) => actor.id === filters.actor);
    const shown =
        filters.actor === null
            ? t('Everyone')
            : (selected?.name ?? t('One account'));

    const choose = (actor: string | null): void => {
        setOpen(false);
        visit({ ...filters, actor });
    };

    return (
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1.5">
            <Label htmlFor={fieldId}>{t('Actor')}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        id={fieldId}
                        type="button"
                        role="combobox"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-controls={open ? listId : undefined}
                        data-slot="audit-actor-filter"
                        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:pointer-events-none [&_svg]:shrink-0"
                    >
                        <span className="truncate">{shown}</span>
                        <ChevronsUpDown
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    aria-label={t('Actor')}
                    className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-48 overflow-hidden rounded-lg p-0 shadow-popover"
                >
                    <Command>
                        <CommandInput placeholder={t('Search by name')} />
                        <CommandList ref={listRef}>
                            <CommandEmpty>
                                {t('Nobody on this page has this name.')}
                            </CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    value={t('Everyone')}
                                    onSelect={() => choose(null)}
                                >
                                    <span className="truncate">
                                        {t('Everyone')}
                                    </span>
                                    {filters.actor === null && (
                                        <Check
                                            aria-hidden="true"
                                            className="ml-auto size-4"
                                        />
                                    )}
                                </CommandItem>
                                {actors.map((actor) => (
                                    <CommandItem
                                        key={actor.id}
                                        value={`${actor.name} ${actor.id}`}
                                        onSelect={() => choose(actor.id)}
                                    >
                                        <PersonAvatar
                                            decorative
                                            name={actor.name}
                                            src={actor.avatarUrl}
                                            size="sm"
                                            className="shrink-0"
                                        />
                                        <span className="truncate">
                                            {actor.name}
                                        </span>
                                        {filters.actor === actor.id && (
                                            <Check
                                                aria-hidden="true"
                                                className="ml-auto size-4"
                                            />
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

export function AuditFilters({
    filters,
    events,
}: {
    filters: AuditLogFilters;
    events: AuditEvent[];
}): ReactElement {
    const { t } = useTrans();
    const groupId = useId();
    const groups: Array<{ value: AuditGroup; label: string }> = [
        { value: 'settings', label: t('Settings') },
        { value: 'accounts', label: t('Accounts') },
        { value: 'signIn', label: t('Sign-in') },
        { value: 'tokens', label: t('Tokens') },
    ];

    return (
        <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
                <Label htmlFor={groupId}>{t('Events')}</Label>
                <Select
                    value={filters.group ?? AllGroups}
                    onValueChange={(value) =>
                        visit({
                            ...filters,
                            group:
                                value === AllGroups
                                    ? null
                                    : (value as AuditGroup),
                        })
                    }
                >
                    <SelectTrigger
                        id={groupId}
                        data-slot="audit-group-filter"
                        className="w-full"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={AllGroups}>{t('All')}</SelectItem>
                        {groups.map((group) => (
                            <SelectItem key={group.value} value={group.value}>
                                {group.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ActorPicker filters={filters} actors={pageActors(events)} />
        </div>
    );
}
