import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Ref } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SectionAction = {
    label: string;
    icon: LucideIcon;
} & (
    | { href: NonNullable<InertiaLinkProps['href']>; onSelect?: undefined }
    | { href?: undefined; onSelect: () => void }
);

type Props = {
    /** Accessible name of the "…" button, such as "Planning poker actions". */
    label: string;
    items: SectionAction[];
    triggerRef?: Ref<HTMLButtonElement>;
};

/** The "…" menu of a section of the team page: its secondary entries. */
export function SectionActionsMenu({ label, items, triggerRef }: Props) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                >
                    <Ellipsis aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {items.map(
                    ({ label: itemLabel, icon: Icon, href, onSelect }) =>
                        href === undefined ? (
                            <DropdownMenuItem
                                key={itemLabel}
                                onSelect={onSelect}
                            >
                                <Icon aria-hidden />
                                <span className="truncate">{itemLabel}</span>
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem key={itemLabel} asChild>
                                <Link href={href}>
                                    <Icon aria-hidden />
                                    <span className="truncate">
                                        {itemLabel}
                                    </span>
                                </Link>
                            </DropdownMenuItem>
                        ),
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
