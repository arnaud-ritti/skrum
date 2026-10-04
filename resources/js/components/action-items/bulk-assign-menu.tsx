import { UserRoundX } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTrans } from '@/hooks/use-trans';

/** From this many people the menu has a search field (spec 24 §9.4). */
const SearchFrom = 8;

export type BulkAssignee = { id: string; name: string; avatarUrl: string };

type Props = {
    /** The members common to every team of the selection. */
    members: BulkAssignee[];
    /** The bar's button, as the trigger. */
    trigger: ReactNode;
    onAssign: (userId: string | null) => void;
};

const Unassigned = '__unassigned';

/** "Unassigned" then the members common to the selection's teams. */
export function BulkAssignMenu({ members, trigger, onAssign }: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    const pick = (userId: string | null): void => {
        setOpen(false);
        onAssign(userId);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
                <Command label={t('Assign')}>
                    {members.length >= SearchFrom && (
                        <CommandInput placeholder={t('Search')} />
                    )}
                    <CommandList>
                        <CommandEmpty>{t('No member found')}</CommandEmpty>
                        <CommandItem
                            value={Unassigned}
                            keywords={[t('Unassigned')]}
                            onSelect={() => pick(null)}
                        >
                            <UserRoundX
                                aria-hidden
                                className="text-muted-foreground"
                            />
                            {t('Unassigned')}
                        </CommandItem>
                        {members.map((member) => (
                            <CommandItem
                                key={member.id}
                                value={member.id}
                                keywords={[member.name]}
                                onSelect={() => pick(member.id)}
                            >
                                <PersonAvatar
                                    decorative
                                    size="xs"
                                    name={member.name}
                                    src={member.avatarUrl}
                                />
                                <span className="truncate">{member.name}</span>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
