import { Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { NavUser } from '@/components/nav-user';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { KeyboardShortcutsTrigger } from '@/components/skrum/keyboard-shortcuts';
import { SessionFrame } from '@/components/skrum/frames';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { KeyboardShortcutsDialog } from '@/components/workspaces/keyboard-shortcuts-dialog';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useSidebarModel } from '@/hooks/use-sidebar-model';
import { useTrans } from '@/hooks/use-trans';

/** The viewer, as the end of the header shows them. */
export type SessionSelf = {
    name: string;
    avatarUrl?: string | null;
    isGuest?: boolean;
    /** Presence colour, 1 to 12, on the screens that give one to each person. */
    presence?: number;
};

/** `rail`: the application sidebar of a member. `logo`: no rail, the logo opens the header. */
export type SessionChrome = 'rail' | 'logo';

type SessionLayoutProps = {
    title: ReactNode;
    phases?: ReactNode;
    status?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    chrome?: SessionChrome;
    /** Where the logo leads; absent or null for a guest. */
    homeHref?: NavHref | null;
    /** The viewer; a signed-in user is shown without it, a guest is not. */
    self?: SessionSelf | null;
    /** The cards of a poker game: the shortcuts dialog lists the keys of those it holds. */
    deck?: readonly string[];
    children: ReactNode;
};

type FrameSlots = Omit<
    SessionLayoutProps,
    'chrome' | 'homeHref' | 'self' | 'deck'
> & {
    logo?: ReactNode;
    avatar?: ReactNode;
};

function SelfAvatar({ self }: { self: SessionSelf }) {
    const presence =
        self.presence !== undefined && self.presence >= 1 && self.presence <= 12
            ? (self.presence as AvatarPresence)
            : undefined;

    return (
        <span
            data-slot="session-self"
            className="hidden shrink-0 md:inline-flex"
        >
            <PersonAvatar
                name={self.name}
                src={self.avatarUrl}
                kind={self.isGuest ? 'guest' : 'member'}
                presence={presence}
            />
        </span>
    );
}

function HeaderLogo({
    homeHref,
    isGuest,
}: {
    homeHref?: NavHref | null;
    isGuest: boolean;
}) {
    const { t } = useTrans();
    const { brand } = usePage().props;
    const logo = (
        <BrandLogo
            brand={brand}
            className="h-7 max-w-24"
            fallback={<SkrumLogo variant="symbol" className="size-7" />}
        />
    );

    if (!homeHref) {
        return (
            <span
                data-slot="session-logo"
                className={
                    isGuest ? 'hidden shrink-0 md:inline-flex' : 'shrink-0'
                }
            >
                {logo}
            </span>
        );
    }

    return (
        <Link
            href={homeHref}
            aria-label={t('Back to the team')}
            data-slot="session-logo"
            className="inline-flex shrink-0 rounded-md outline-offset-2 outline-ring focus-visible:outline-2"
        >
            {logo}
        </Link>
    );
}

function MemberSessionLayout({ children, ...slots }: FrameSlots) {
    const sidebar = useSidebarModel('sessions');

    return (
        <SessionFrame sidebar={{ ...sidebar, footer: <NavUser /> }} {...slots}>
            {children}
        </SessionFrame>
    );
}

export default function SessionLayout({
    children,
    chrome = 'rail',
    homeHref,
    self,
    deck,
    actions,
    ...rest
}: SessionLayoutProps) {
    const user = usePage().props.auth?.user;
    const shortcuts = useGlobalShortcuts();
    const viewer: SessionSelf | null =
        self ?? (user ? { name: user.name, avatarUrl: user.avatarUrl } : null);
    const avatar = viewer ? <SelfAvatar self={viewer} /> : undefined;
    const hasRail = chrome === 'rail' && !!user;
    const slots = {
        ...rest,
        actions: (
            <>
                {actions}
                <KeyboardShortcutsTrigger
                    onClick={() => shortcuts.setOpen(true)}
                    className="hidden shrink-0 md:inline-flex"
                />
            </>
        ),
    };
    const dialog = (
        <KeyboardShortcutsDialog
            shortcuts={shortcuts}
            palette={false}
            sidebar={hasRail}
            deck={deck}
            preference="switch"
        />
    );

    if (chrome === 'logo') {
        return (
            <>
                <SessionFrame
                    {...slots}
                    logo={<HeaderLogo homeHref={homeHref} isGuest={!user} />}
                    avatar={avatar}
                >
                    {children}
                </SessionFrame>
                {dialog}
            </>
        );
    }

    if (!user) {
        return (
            <>
                <SessionFrame {...slots} avatar={avatar}>
                    {children}
                </SessionFrame>
                {dialog}
            </>
        );
    }

    return (
        <>
            <MemberSessionLayout {...slots} avatar={avatar}>
                {children}
            </MemberSessionLayout>
            {dialog}
        </>
    );
}
