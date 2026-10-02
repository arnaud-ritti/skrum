import type { ReactNode } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PersonAvatar, type AvatarPresence } from '@/components/ui/avatar';
import { SidebarMenuButton } from '@/components/ui/sidebar';

export type UserCardUser = {
    name: string;
    role: string;
    avatarUrl?: string | null;
    presence?: AvatarPresence;
};

export function UserCard({
    user,
    menu,
}: {
    user: UserCardUser;
    menu?: ReactNode;
}) {
    const content = (
        <>
            <PersonAvatar
                decorative
                name={user.name}
                src={user.avatarUrl}
                presence={user.presence}
            />
            <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">
                    {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {user.role}
                </span>
            </span>
            {menu !== undefined && (
                <ChevronsUpDown className="size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
            )}
        </>
    );

    if (menu === undefined) {
        return (
            <div
                data-slot="user-card"
                className="flex h-12 items-center gap-2 overflow-hidden rounded-md p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                title={user.name}
            >
                {content}
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                    data-slot="user-card"
                    size="lg"
                    tooltip={user.name}
                    aria-label={`${user.name}, ${user.role}`}
                >
                    {content}
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-64">
                {menu}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
