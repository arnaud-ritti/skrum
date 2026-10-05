import { Link, router } from '@inertiajs/react';
import { Info, Keyboard, LogOut, Settings } from 'lucide-react';
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { UserInfo } from '@/components/user-info';
import { openKeyboardShortcutsEvent } from '@/lib/shortcuts/events';
import { logout } from '@/routes';
import { show as about } from '@/routes/about';
import { edit } from '@/routes/profile';
import type { User } from '@/types';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    user: User;
};

export function UserMenuContent({ user }: Props) {
    const { t } = useTrans();

    const cleanup = () => {
        document.body.style.removeProperty('pointer-events');
    };

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full cursor-pointer"
                        href={edit()}
                        prefetch
                        onClick={cleanup}
                    >
                        <Settings className="mr-2" />
                        {t('Settings')}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full cursor-pointer"
                        href={about()}
                        prefetch
                        onClick={cleanup}
                    >
                        <Info className="mr-2" />
                        {t('About')}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="max-md:hidden"
                    aria-keyshortcuts="?"
                    onSelect={() =>
                        window.dispatchEvent(
                            new Event(openKeyboardShortcutsEvent),
                        )
                    }
                >
                    <Keyboard className="mr-2" />
                    <span className="min-w-0 flex-1 truncate">
                        {t('Keyboard shortcuts')}
                    </span>
                    <Kbd aria-hidden="true">?</Kbd>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link
                    className="block w-full cursor-pointer"
                    href={logout()}
                    as="button"
                    onClick={handleLogout}
                    data-test="logout-button"
                >
                    <LogOut className="mr-2" />
                    {t('Log out')}
                </Link>
            </DropdownMenuItem>
        </>
    );
}
