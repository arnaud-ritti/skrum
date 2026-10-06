import { Link, usePage } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { KeyboardShortcutsTrigger } from '@/components/skrum/keyboard-shortcuts';
import { SessionFrame } from '@/components/skrum/frames';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { KeyboardShortcutsDialog } from '@/components/workspaces/keyboard-shortcuts-dialog';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** The viewer, as the end of the header shows them. */
export type SessionSelf = {
    name: string;
    avatarUrl?: string | null;
    isGuest?: boolean;
    /** Presence colour, 1 to 12, on the screens that give one to each person. */
    presence?: number;
};

/** `title`: the header opens with the title and its back arrow. `logo`: the logo opens it. */
export type SessionChrome = 'title' | 'logo';

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

/** The viewer at the end of a session header; also used by the survey's own header. */
export function SelfAvatar({ self }: { self: SessionSelf }) {
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

/**
 * The logo that opens the header of `chrome="logo"`; also used by the
 * survey's own header. `phoneBack`: below `md` the link back to the team is a
 * back arrow instead (MobileRituals).
 */
export function HeaderLogo({
    homeHref,
    isGuest,
    phoneBack = false,
}: {
    homeHref?: NavHref | null;
    isGuest: boolean;
    phoneBack?: boolean;
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
            className={cn(
                'inline-flex shrink-0 rounded-md outline-offset-2 outline-ring focus-visible:outline-2',
                phoneBack &&
                    'items-center justify-center max-md:-ml-2 max-md:size-11 max-md:rounded-lg max-md:hover:bg-accent',
            )}
        >
            {phoneBack ? (
                <>
                    <ChevronLeft aria-hidden className="size-6 md:hidden" />
                    <span
                        data-slot="session-logo-mark"
                        className="inline-flex max-md:hidden"
                    >
                        {logo}
                    </span>
                </>
            ) : (
                logo
            )}
        </Link>
    );
}

export default function SessionLayout({
    children,
    chrome = 'title',
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

    return (
        <>
            <SessionFrame
                {...rest}
                logo={
                    chrome === 'logo' ? (
                        <HeaderLogo
                            homeHref={homeHref}
                            isGuest={!user}
                            phoneBack
                        />
                    ) : undefined
                }
                actions={
                    <>
                        {actions}
                        <KeyboardShortcutsTrigger
                            onClick={() => shortcuts.setOpen(true)}
                            className="hidden shrink-0 md:inline-flex"
                        />
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
