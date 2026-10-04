import { Link, usePage } from '@inertiajs/react';
import {
    Check,
    Copy,
    House,
    LogIn,
    LogOut,
    RefreshCw,
    RotateCcw,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ErrorArt } from '@/components/auth/error-art';
import type { ErrorArtKind } from '@/components/auth/error-art';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { reloadDocument } from '@/lib/reload-document';
import { dashboard, login, logout } from '@/routes';
import type { Brand } from '@/types';

type ErrorPageProps = {
    status: number;
    /** 500 only: the id written on every log line of the failed request. */
    requestId?: string | null;
    /** 500 only: `Y-m-d H:i:s`, in UTC. */
    occurredAt?: string | null;
    /** 429 only: seconds, from the `Retry-After` header. */
    retryAfter?: number | null;
    /** A failed request other than a GET: the page it came from. */
    returnTo?: string | null;
    /** Place left: "Instance status" and "Help", at the end of the header. */
    headerLinks?: ReactNode;
    /** Place left: the search action of the 404 page, after "Back to my teams". */
    search?: ReactNode;
    /**
     * The access request of a 403 about a known team: it brings its own
     * sentence and actions, and the title names the team.
     */
    accessRequest?: ReactNode;
    /** Place left: the version, after the name of the instance in the footer. */
    version?: ReactNode;
};

const CopiedFor = 2000;

const arts: Record<number, ErrorArtKind> = {
    403: 'locked',
    404: 'missing',
    419: 'clock',
    429: 'clock',
    500: 'broken',
};

/** The 500 page comes without the shared props: none of them is required. */
type ErrorPageShared = {
    auth?: { user?: { email: string } | null };
    brand?: Brand;
    name?: string;
};

function ErrorId({
    requestId,
    occurredAt,
}: {
    requestId: string;
    occurredAt?: string | null;
}) {
    const { t } = useTrans();
    const labelId = useId();
    const [, copy] = useClipboard();
    const [outcome, setOutcome] = useState<'copied' | 'refused' | null>(null);
    const copied = outcome === 'copied';

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timeout = window.setTimeout(() => setOutcome(null), CopiedFor);

        return () => window.clearTimeout(timeout);
    }, [copied]);

    return (
        <div
            data-slot="error-id"
            role="group"
            aria-labelledby={labelId}
            className="flex w-full max-w-md flex-col gap-1.5 text-left"
        >
            <span id={labelId} className="text-sm font-medium">
                {t('Error ID')}
            </span>
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-muted py-1 pr-1 pl-3">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                    <code className="font-mono text-sm break-all">
                        {requestId}
                    </code>
                    {occurredAt && (
                        <span className="text-xs text-muted-foreground">
                            {occurredAt} UTC
                        </span>
                    )}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    aria-label={copied ? t('Copied') : t('Copy error ID')}
                    onClick={() =>
                        void copy(requestId).then((done) =>
                            setOutcome(done ? 'copied' : 'refused'),
                        )
                    }
                >
                    {copied ? <Check /> : <Copy />}
                    <span>{copied ? t('Copied') : t('Copy')}</span>
                </Button>
            </div>
            <span
                role="status"
                className={
                    outcome === 'refused'
                        ? 'text-xs text-muted-foreground'
                        : 'sr-only'
                }
            >
                {copied && t('Copied')}
                {outcome === 'refused' &&
                    t(
                        'The ID could not be copied. Select it and copy it by hand.',
                    )}
            </span>
        </div>
    );
}

export function ErrorPage({
    status,
    requestId,
    occurredAt,
    retryAfter,
    returnTo,
    headerLinks,
    search,
    accessRequest,
    version,
}: ErrorPageProps) {
    const { t } = useTrans();
    const { auth, brand, name } = usePage().props as ErrorPageShared;
    const email = auth?.user?.email;
    const signedIn = email !== undefined;
    const reload = () => reloadDocument(returnTo);

    const home = (variant: 'default' | 'outline' = 'default') => (
        <Button asChild variant={variant}>
            <a href={dashboard().url}>
                <House />
                <span className="truncate">{t('Back to my teams')}</span>
            </a>
        </Button>
    );
    const homeOrLogin = signedIn ? (
        home()
    ) : (
        <Button asChild>
            <a href={login().url}>
                <LogIn />
                <span className="truncate">{t('Log in')}</span>
            </a>
        </Button>
    );
    const [beforeEmail, afterEmail = ''] = t(
        "You're signed in as :email. Ask an administrator of the team or of the workspace for access.",
    ).split(':email');

    const copy: Record<
        number,
        {
            overline: string;
            title: string;
            description: ReactNode;
            actions: ReactNode;
        }
    > = {
        404: {
            overline: t('Error 404'),
            title: t("This page doesn't exist (anymore)"),
            description: signedIn
                ? t(
                      'The link may be incomplete, or the facilitator deleted the session. Check the address, or start again from your teams.',
                  )
                : t(
                      'The link may be incomplete, or the facilitator deleted the session. Check the address, or log in to find your teams.',
                  ),
            actions: (
                <>
                    {homeOrLogin}
                    {search !== undefined && (
                        <span data-slot="error-page-search">{search}</span>
                    )}
                </>
            ),
        },
        403: {
            overline: t('Error 403 · Access denied'),
            title: t("You don't have access to this page"),
            description: signedIn ? (
                <>
                    {beforeEmail}
                    <b className="font-semibold text-foreground">{email}</b>
                    {afterEmail}
                </>
            ) : (
                t(
                    'Log in with an account that has access, or ask an administrator for it.',
                )
            ),
            actions: (
                <>
                    {homeOrLogin}
                    {signedIn && (
                        <Button asChild variant="ghost">
                            <Link href={logout()} as="button">
                                <LogOut />
                                <span className="truncate">
                                    {t('Switch account')}
                                </span>
                            </Link>
                        </Button>
                    )}
                </>
            ),
        },
        419: {
            overline: t('Error 419'),
            title: t('This page has expired'),
            description: t(
                'It stayed open too long to be sent safely. Reload it, then try again.',
            ),
            actions: (
                <Button type="button" onClick={reload}>
                    <RefreshCw />
                    <span className="truncate">{t('Reload')}</span>
                </Button>
            ),
        },
        429: {
            overline: t('Error 429'),
            title: t('Too many requests'),
            description: (
                <>
                    {t(
                        'This went a little too fast for the server. Wait a moment, then try again.',
                    )}
                    {typeof retryAfter === 'number' && (
                        <>
                            {' '}
                            <span data-slot="error-retry-after">
                                {retryAfter === 1
                                    ? t('You can retry in 1 second.')
                                    : t('You can retry in :seconds seconds.', {
                                          seconds: retryAfter,
                                      })}
                            </span>
                        </>
                    )}
                </>
            ),
            actions: (
                <Button type="button" onClick={reload}>
                    <RotateCcw />
                    <span className="truncate">{t('Try again')}</span>
                </Button>
            ),
        },
        500: {
            overline: t('Error 500'),
            title: t('Something broke on our side'),
            description: requestId
                ? t(
                      'Your cards and action items are safe. Try again in a moment; if it happens again, send this ID to your admin.',
                  )
                : t(
                      'Your cards and action items are safe. Try again in a moment.',
                  ),
            actions: (
                <>
                    <Button type="button" onClick={reload}>
                        <RotateCcw />
                        <span className="truncate">{t('Try again')}</span>
                    </Button>
                    {signedIn && home('outline')}
                </>
            ),
        },
    };
    const known = status in copy ? status : 500;
    const { overline, title, description, actions } = copy[known];
    const asksForTeam = known === 403 && accessRequest !== undefined;

    return (
        <div
            data-slot="error-page"
            data-status={status}
            className="flex min-h-svh min-w-0 flex-col gap-4 p-4 md:px-6"
        >
            <header className="flex min-w-0 items-center gap-4">
                <BrandLogo
                    brand={brand}
                    className="h-8"
                    fallback={<SkrumLogo className="h-6 w-auto" />}
                />
                <span className="grow" />
                {headerLinks !== undefined && (
                    <nav
                        data-slot="error-page-links"
                        className="flex items-center gap-4 text-xs"
                    >
                        {headerLinks}
                    </nav>
                )}
            </header>
            <main className="mx-auto flex w-full max-w-124 flex-1 flex-col items-center justify-center gap-3 text-center">
                <ErrorArt kind={arts[known]} />
                <p className="text-overline text-skrum-primary-text uppercase">
                    {overline}
                </p>
                <h1 className="text-xl font-title tracking-subheading text-balance">
                    {asksForTeam
                        ? t("You don't have access to this team")
                        : title}
                </h1>
                {!asksForTeam && (
                    <p className="text-sm/snug text-pretty text-muted-foreground">
                        {description}
                    </p>
                )}
                {known === 500 && requestId && (
                    <ErrorId requestId={requestId} occurredAt={occurredAt} />
                )}
                {asksForTeam ? (
                    <div
                        data-slot="error-page-access-request"
                        className="w-full"
                    >
                        {accessRequest}
                    </div>
                ) : (
                    <div
                        data-slot="error-page-actions"
                        className="mt-1 flex flex-wrap items-center justify-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch"
                    >
                        {actions}
                    </div>
                )}
            </main>
            <footer className="min-h-4 text-center text-xs text-muted-foreground">
                {name}
                {version !== undefined && (
                    <span data-slot="error-page-version">
                        {name ? ' · ' : ''}
                        {version}
                    </span>
                )}
            </footer>
        </div>
    );
}
