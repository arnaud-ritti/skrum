import { router, useForm, usePage } from '@inertiajs/react';
import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import TeamRetrosController from '@/actions/App/Http/Controllers/TeamRetrosController';
import InputError from '@/components/input-error';
import { TemplateChips } from '@/components/templates/template-chips';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type {
    CatalogueTemplate,
    CategoryOption,
    TemplateCategory,
} from '@/types';

const DefaultFixedVotes = 5;

type Props = {
    workspaceSlug: string;
    teamId: string;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
};

type RetroForm = {
    title: string;
    template: string;
    is_anonymous: boolean;
    icebreaker_enabled: boolean;
    votes_per_participant: number | null;
};

export function NewRetroDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New retrospective')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
            >
                {open && (
                    <NewRetroForm {...props} onDone={() => setOpen(false)} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function matchesQuery(template: CatalogueTemplate, query: string): boolean {
    const needle = query.trim().toLocaleLowerCase();

    if (needle === '') {
        return true;
    }

    return [
        template.name,
        ...template.columns.map((column) => column.title),
    ].some((text) => text.toLocaleLowerCase().includes(needle));
}

function NewRetroForm({
    workspaceSlug,
    teamId,
    categories,
    catalogue,
    onDone,
}: Props & { onDone: () => void }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
    const form = useForm<RetroForm>({
        title: t('Retro :date', {
            date: new Date().toLocaleDateString(locale, {
                dateStyle: 'medium',
            }),
        }),
        template: '',
        is_anonymous: false,
        icebreaker_enabled: false,
        votes_per_participant: null,
    });

    useEffect(() => {
        if (catalogue === undefined) {
            router.reload({ only: ['catalogue'] });
        }
    }, [catalogue]);

    const visible = (catalogue ?? []).filter(
        (item) =>
            matchesQuery(item, query) &&
            (category === 'all' || item.category === category),
    );
    const chosen =
        catalogue?.find((item) => item.key === form.data.template) ??
        catalogue?.find((item) => !item.isWorkspace) ??
        null;
    const selected =
        chosen !== null && visible.some((item) => item.key === chosen.key)
            ? chosen
            : (visible[0] ?? null);
    const sections = [
        {
            key: 'workspace',
            title: t('Workspace templates'),
            items: visible.filter((item) => item.isWorkspace),
        },
        {
            key: 'common',
            title: t('Common templates'),
            items: visible.filter((item) => item.isCommon),
        },
        {
            key: 'more',
            title: t('More templates'),
            items: visible.filter(
                (item) => !item.isWorkspace && !item.isCommon,
            ),
        },
    ].filter((section) => section.items.length > 0);
    const categoryLabel = (value: string) =>
        categories.find((option) => option.value === value)?.label ?? value;
    const votesAuto = form.data.votes_per_participant === null;

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!selected) {
            return;
        }

        form.transform((data) => ({ ...data, template: selected.key }));
        form.submit(
            TeamRetrosController.store({
                workspace: workspaceSlug,
                team: teamId,
            }),
            { onSuccess: onDone },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New retrospective')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="new-retro-title">{t('Title')}</Label>
                <Input
                    id="new-retro-title"
                    value={form.data.title}
                    maxLength={120}
                    required
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                />
                <InputError message={form.errors.title} />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            value={query}
                            className="pl-8"
                            placeholder={t('Search templates')}
                            aria-label={t('Search templates')}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                    <div
                        className="flex flex-wrap gap-1"
                        role="group"
                        aria-label={t('Category')}
                    >
                        {[
                            { value: 'all' as const, label: t('All') },
                            ...categories,
                        ].map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant={
                                    category === option.value
                                        ? 'secondary'
                                        : 'ghost'
                                }
                                aria-pressed={category === option.value}
                                onClick={() => setCategory(option.value)}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                        {catalogue === undefined &&
                            [0, 1, 2, 3].map((row) => (
                                <Skeleton key={row} className="h-14 w-full" />
                            ))}
                        {catalogue !== undefined && sections.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t('No templates match your search.')}
                            </p>
                        )}
                        {sections.map((section) => (
                            <div key={section.key} className="space-y-1">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                                    {section.title}
                                </h3>
                                <ul className="space-y-1">
                                    {section.items.map((item) => (
                                        <li key={item.key}>
                                            <button
                                                type="button"
                                                aria-pressed={
                                                    selected?.key === item.key
                                                }
                                                className={cn(
                                                    'w-full rounded-md border p-2 text-left hover:bg-muted',
                                                    selected?.key ===
                                                        item.key &&
                                                        'border-primary bg-muted',
                                                )}
                                                onClick={() =>
                                                    form.setData(
                                                        'template',
                                                        item.key,
                                                    )
                                                }
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium">
                                                        {item.name}
                                                    </span>
                                                    {item.category && (
                                                        <span className="shrink-0 text-xs text-muted-foreground">
                                                            {categoryLabel(
                                                                item.category,
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {item.columns.length === 0
                                                        ? t('Empty board')
                                                        : item.columns
                                                              .map(
                                                                  (column) =>
                                                                      column.title,
                                                              )
                                                              .join(' · ')}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <InputError message={form.errors.template} />
                </div>

                <div className="space-y-3 rounded-md border p-3">
                    <h3 className="text-sm font-semibold">{t('Preview')}</h3>
                    {catalogue === undefined && (
                        <Skeleton className="h-32 w-full" />
                    )}
                    {catalogue !== undefined && selected !== null && (
                        <>
                            <p className="font-medium">{selected.name}</p>
                            {selected.columns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t(
                                        'Start with an empty board and add your own columns.',
                                    )}
                                </p>
                            ) : (
                                <TemplateChips
                                    columns={selected.columns}
                                    withDescriptions
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            <Collapsible className="rounded-md border">
                <CollapsibleTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-between"
                    >
                        {t('Settings')}
                        <ChevronDown className="size-4" />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="new-retro-anonymous"
                            checked={form.data.is_anonymous}
                            onCheckedChange={(checked) =>
                                form.setData('is_anonymous', checked === true)
                            }
                        />
                        <Label htmlFor="new-retro-anonymous">
                            {t('Anonymous cards')}
                        </Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="new-retro-icebreaker"
                            checked={form.data.icebreaker_enabled}
                            onCheckedChange={(checked) =>
                                form.setData(
                                    'icebreaker_enabled',
                                    checked === true,
                                )
                            }
                        />
                        <Label htmlFor="new-retro-icebreaker">
                            {t('Icebreaker')}
                        </Label>
                    </div>
                    <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="new-retro-votes-auto"
                                checked={votesAuto}
                                onCheckedChange={(checked) =>
                                    form.setData(
                                        'votes_per_participant',
                                        checked === true
                                            ? null
                                            : DefaultFixedVotes,
                                    )
                                }
                            />
                            <Label htmlFor="new-retro-votes-auto">
                                {t('Automatic vote limit')}
                            </Label>
                        </div>
                        {votesAuto ? (
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'Automatic: number of cards plus 3, at most 10.',
                                )}
                            </p>
                        ) : (
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                className="w-24"
                                aria-label={t('Votes per participant')}
                                value={form.data.votes_per_participant ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'votes_per_participant',
                                        Number(event.target.value),
                                    )
                                }
                            />
                        )}
                        <InputError
                            message={form.errors.votes_per_participant}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button
                    type="submit"
                    disabled={form.processing || selected === null}
                >
                    {t('Start')}
                </Button>
            </DialogFooter>
        </form>
    );
}
