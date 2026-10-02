import { Plus, Settings, Spade, StickyNote, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandFooter,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandItemIcon,
    CommandKbd,
    CommandList,
    CommandLoading,
    CommandPalette,
    CommandShortcut,
} from '@/components/ui/command';
import type { CommandPaletteItem } from '@/components/ui/command';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
                {label}
            </h3>
            {children}
        </section>
    );
}

export default function CommandSection() {
    const { t } = useTrans();
    const [open, setOpen] = useState(true);
    const noop = () => {};
    const label = t('New retro');
    const query = t('retro');
    const matchStart = label.toLowerCase().indexOf(query.toLowerCase());

    const items: CommandPaletteItem[] = [
        {
            id: 'retro',
            group: 'actions',
            label: t('New retro'),
            icon: Plus,
            shortcut: ['⌘', 'N'],
            onSelect: noop,
        },
        {
            id: 'poker',
            group: 'actions',
            label: t('New poker session'),
            icon: Spade,
            shortcut: ['⌘', 'P'],
            onSelect: noop,
        },
        {
            id: 'invite',
            group: 'actions',
            label: t('Invite to team Atlas'),
            icon: UserPlus,
            onSelect: noop,
        },
        {
            id: 's42',
            group: 'recent',
            label: t('Retro sprint 42'),
            icon: StickyNote,
            meta: t('Atlas · 2 days ago'),
            onSelect: noop,
        },
        {
            id: 's41',
            group: 'recent',
            label: t('Retro sprint 41'),
            icon: StickyNote,
            meta: t('Atlas · Sept 16'),
            onSelect: noop,
        },
        {
            id: 'settings',
            group: 'goto',
            label: t('Instance settings'),
            icon: Settings,
            shortcut: ['G', 'S'],
            keywords: ['preferences'],
            onSelect: noop,
        },
    ];

    const footer = (
        <CommandFooter>
            <span className="inline-flex items-center gap-1.5">
                <CommandKbd>↑</CommandKbd>
                <CommandKbd>↓</CommandKbd>
                {t('navigate')}
            </span>
            <span className="inline-flex items-center gap-1.5">
                <CommandKbd>↵</CommandKbd>
                {t('open')}
            </span>
            <span className="ml-auto">{t(':count results', { count: 5 })}</span>
        </CommandFooter>
    );

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
            <State label={t('Palette, trigger (Ctrl K or /)')}>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        {t('Open the command palette')}
                    </Button>
                    <CommandKbd>Ctrl K</CommandKbd>
                </div>
                <CommandPalette
                    open={open}
                    onOpenChange={setOpen}
                    items={items}
                />
            </State>
            <State
                label={t('Empty query, groups, active item, shortcuts, footer')}
            >
                <Command
                    className="rounded-xl border shadow-modal"
                    defaultValue="retro"
                >
                    <CommandInput
                        placeholder={t('Search or run a command...')}
                    />
                    <CommandList>
                        <CommandGroup heading={t('Actions')}>
                            {items.slice(0, 3).map((item) => (
                                <CommandItem key={item.id} value={item.id}>
                                    <CommandItemIcon>
                                        <item.icon />
                                    </CommandItemIcon>
                                    <span className="flex-1 truncate">
                                        {item.label}
                                    </span>
                                    {item.shortcut && (
                                        <CommandShortcut>
                                            {item.shortcut.map((key) => (
                                                <CommandKbd key={key}>
                                                    {key}
                                                </CommandKbd>
                                            ))}
                                        </CommandShortcut>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandGroup heading={t('Recent sessions')}>
                            {items.slice(3, 5).map((item) => (
                                <CommandItem key={item.id} value={item.id}>
                                    <CommandItemIcon>
                                        <item.icon />
                                    </CommandItemIcon>
                                    <span className="flex-1 truncate">
                                        {item.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {item.meta}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                    {footer}
                </Command>
            </State>
            <State label={t('Filtered with highlighted match')}>
                <Command
                    className="rounded-xl border shadow-modal"
                    shouldFilter={false}
                >
                    <CommandInput value={query} readOnly />
                    <CommandList>
                        <CommandGroup heading={t('Actions')}>
                            <CommandItem value="retro">
                                <CommandItemIcon>
                                    <Plus />
                                </CommandItemIcon>
                                <span className="flex-1 truncate">
                                    {matchStart === -1 ? (
                                        label
                                    ) : (
                                        <>
                                            {label.slice(0, matchStart)}
                                            <strong>
                                                {label.slice(
                                                    matchStart,
                                                    matchStart + query.length,
                                                )}
                                            </strong>
                                            {label.slice(
                                                matchStart + query.length,
                                            )}
                                        </>
                                    )}
                                </span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </State>
            <State label={t('Loading')}>
                <Command className="rounded-xl border shadow-modal">
                    <CommandInput
                        placeholder={t('Search or run a command...')}
                    />
                    <CommandList>
                        <CommandLoading>{t('Searching...')}</CommandLoading>
                    </CommandList>
                </Command>
            </State>
            <State label={t('No result')}>
                <Command
                    className="rounded-xl border shadow-modal"
                    shouldFilter={false}
                >
                    <CommandInput value="zzz" readOnly />
                    <CommandList>
                        <div className="flex flex-col gap-1 py-6 text-center text-sm text-muted-foreground">
                            <span>
                                {t('No results for “:query”', { query: 'zzz' })}
                            </span>
                            <span className="text-xs">
                                {t('Try a shorter or different word.')}
                            </span>
                        </div>
                    </CommandList>
                </Command>
            </State>
        </div>
    );
}
