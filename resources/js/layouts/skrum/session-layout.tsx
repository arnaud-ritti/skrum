import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { KeyboardShortcutsTrigger } from '@/components/skrum/keyboard-shortcuts';
import { SessionFrame } from '@/components/skrum/frames';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { KeyboardShortcutsDialog } from '@/components/workspaces/keyboard-shortcuts-dialog';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useTrans } from '@/hooks/use-trans';
import type { User } from '@/types';

/** The viewer, as the end of the header shows them. */
export type SessionSelf = {
    name: string;
    avatarUrl?: string | null;
    isGuest?: boolean;
    /** Presence colour, 1 to 12, on the screens that give one to each person. */
    presence?: number;
};

/**
 * `title`: the title brings its own back arrow. `logo`: the title has none
 * (a whiteboard), and the header opens with the way back.
 */
export type SessionChrome = 'title' | 'logo';

type SessionLayoutProps = {
    title: ReactNode;
    phases?: ReactNode;
    status?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    chrome?: SessionChrome;
    /** Where the back arrow of `chrome="logo"` leads; absent or null for a guest. */
    homeHref?: NavHref | null;
    /** The viewer; a signed-in user is shown without it, a guest is not. */
    self?: SessionSelf | null;
    /** The cards of a poker game: the shortcuts dialog lists the keys of those it holds. */
    deck?: readonly string[];
    /** The screen lists the keyboard shortcuts in a menu of its own: no button for them here. */
    shortcutsInMenu?: boolean;
    children: ReactNode;
};

/**
 * The viewer at the end of a session header; also used by the survey's own
 * header. With `user`, the signed-in viewer, it opens the user menu the
 * sidebar holds on the other screens, and shows at every width; a guest's
 * avatar opens nothing and gives way below `md`.
 */
export function SelfAvatar({
    self,
    user,
}: {
    self: SessionSelf;
    user?: User | null;
}) {
    const presence =
        self.presence !== undefined && self.presence >= 1 && self.presence <= 12
            ? (self.presence as AvatarPresence)
            : undefined;
    const avatar = (
        <PersonAvatar
            name={self.name}
            src={self.avatarUrl}
            kind={self.isGuest ? 'guest' : 'member'}
            presence={presence}
        />
    );

    if (!user) {
        return (
            <span
                data-slot="session-self"
                className="hidden shrink-0 md:inline-flex"
            >
                {avatar}
            </span>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    data-slot="session-self"
                    className="inline-flex shrink-0 rounded-full outline-offset-2 outline-ring focus-visible:outline-2"
                >
                    {avatar}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56 rounded-lg">
                <UserMenuContent user={user} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * What opens a session header before its title; also used by the survey's
 * own header. With a way back, the arrow of a member. Without one, the
 * instance's mark: a guest has nowhere to go, so it is not a link.
 */
export function HeaderLogo({ homeHref }: { homeHref?: NavHref | null }) {
    const { t } = useTrans();
    const { brand } = usePage().props;

    if (homeHref) {
        return (
            <Button asChild variant="ghost" size="icon-sm">
                <Link
                    href={homeHref}
                    aria-label={t('Back to the team')}
                    data-slot="session-back"
                >
                    <ArrowLeft aria-hidden />
                </Link>
            </Button>
        );
    }

    return (
        <span data-slot="session-logo" className="inline-flex shrink-0">
            <BrandLogo
                brand={brand}
                className="h-7 max-w-24"
                fallback={<SkrumLogo variant="symbol" className="size-7" />}
            />
        </span>
    );
}

export default function SessionLayout({
    children,
    chrome = 'title',
    homeHref,
    self,
    deck,
    shortcutsInMenu = false,
    actions,
    ...rest
}: SessionLayoutProps) {
    const user = usePage().props.auth?.user;
    const shortcuts = useGlobalShortcuts();
    const viewer: SessionSelf | null =
        self ?? (user ? { name: user.name, avatarUrl: user.avatarUrl } : null);
    const avatar = viewer ? (
        <SelfAvatar self={viewer} user={user} />
    ) : undefined;
    const isGuest = self?.isGuest ?? !user;

    return (
        <>
            <SessionFrame
                {...rest}
                logo={
                    isGuest || chrome === 'logo' ? (
                        <HeaderLogo homeHref={isGuest ? null : homeHref} />
                    ) : undefined
                }
                actions={
                    <>
                        {actions}
                        {!shortcutsInMenu && (
                            <KeyboardShortcutsTrigger
                                onClick={() => shortcuts.setOpen(true)}
                                className="hidden shrink-0 md:inline-flex"
                            />
                        )}
                    </>
                }
                avatar={avatar}
            >
                {children}
            </SessionFrame>
            <KeyboardShortcutsDialog
                shortcuts={shortcuts}
                palette={false}
                sidebar={false}
                deck={deck}
                preference="switch"
            />
        </>
    );
}
