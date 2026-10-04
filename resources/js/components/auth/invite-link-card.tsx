import { Form, Link, usePage } from '@inertiajs/react';
import { Link2Off, MailCheck } from 'lucide-react';
import { useState } from 'react';
import InviteLinkMembershipsController from '@/actions/App/Http/Controllers/InviteLinkMembershipsController';
import { AccessNotice } from '@/components/auth/access-notice';
import { authLinkClass } from '@/components/auth/auth-link';
import {
    InvitationCard,
    InvitationSummary,
} from '@/components/auth/invitation-card';
import type { InvitationPerson } from '@/components/auth/invitation-card';
import { SsoButtons } from '@/components/auth/sso-buttons';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTrans } from '@/hooks/use-trans';
import type { TeamMarkData, TeamRoleValue } from '@/lib/invitations/types';
import { login, logout, register } from '@/routes';
import { send } from '@/routes/verification';
import type { SsoProviderOption } from '@/types';

/**
 * Props of the page `invite-links/show`. An unknown token sends `isInvalid`
 * alone; an expired or turned-off link sends `isUsable: false` with the team,
 * the workspace and the link's creator. There is no use limit (decision 3 C).
 */
export type InviteLinkProps = {
    isInvalid: boolean;
    isUsable?: boolean;
    token?: string;
    /** The team's name, also sent for a link that no longer works. */
    teamName?: string;
    team?: TeamMarkData;
    workspaceName?: string;
    inviter?: (Pick<InvitationPerson, 'name'> & { avatarUrl?: string }) | null;
    teamRole?: TeamRoleValue;
    membersCount?: number;
    members?: InvitationPerson[];
    isLoggedIn?: boolean;
    isVerified?: boolean;
    canRegister?: boolean;
    /** Only single sign-on signs in: no "Sign in", no "Create an account". */
    ssoRequired?: boolean;
    ssoProviders?: SsoProviderOption[];
};

type InviteLinkState = 'logged-out' | 'join' | 'unverified';

function stateOf(isLoggedIn: boolean, isVerified: boolean): InviteLinkState {
    if (!isLoggedIn) {
        return 'logged-out';
    }

    return isVerified ? 'join' : 'unverified';
}

function ResendVerification() {
    const { t } = useTrans();
    const [sent, setSent] = useState(false);

    return (
        <div className="flex w-full min-w-0 flex-col gap-3">
            {sent && (
                <Alert
                    variant="success"
                    title={t(
                        'A new verification link has been sent to the email address you provided during registration.',
                    )}
                />
            )}
            <Form
                {...send.form()}
                onSuccess={() => setSent(true)}
                className="flex min-w-0 flex-col"
            >
                {({ processing }) => (
                    <LoadingButton
                        type="submit"
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        loading={processing}
                    >
                        <span className="truncate">
                            {t('Resend verification email')}
                        </span>
                    </LoadingButton>
                )}
            </Form>
        </div>
    );
}

export function InviteLinkCard({
    isInvalid,
    isUsable = false,
    token = '',
    team,
    workspaceName = '',
    inviter = null,
    teamRole = 'member',
    membersCount,
    members = [],
    isLoggedIn = false,
    isVerified = false,
    canRegister = false,
    ssoRequired = false,
    ssoProviders = [],
}: InviteLinkProps) {
    const { t } = useTrans();
    const { auth } = usePage().props;
    const user = auth?.user ?? null;

    if (isInvalid) {
        return <InvitationCard isInvalid />;
    }

    if (!isUsable || team === undefined) {
        return (
            <AccessNotice
                icon={Link2Off}
                tone="warning"
                title={t('Invitation')}
                description={t('This link no longer works.')}
                hint={
                    inviter === null
                        ? t('Ask a team owner for a new one.')
                        : t('Ask :name for a new one.', { name: inviter.name })
                }
            />
        );
    }

    const state = stateOf(isLoggedIn, isVerified);

    if (state === 'unverified') {
        return (
            <AccessNotice
                icon={MailCheck}
                title={t('Verify your address to join :team', {
                    team: team.name,
                })}
                description={t(
                    'Open the link we sent you, then come back to this page.',
                )}
                action={<ResendVerification />}
            />
        );
    }

    return (
        <Card
            data-slot="invite-link-card"
            data-state={state}
            className="w-full min-w-0 gap-4 p-5 shadow-raised sm:p-8"
        >
            <InvitationSummary
                inviter={inviter}
                team={team}
                workspaceName={workspaceName}
                joinedRole={teamRole}
                membersCount={membersCount}
                members={members}
            />

            <Separator />

            {state === 'logged-out' && ssoRequired && (
                <SsoButtons providers={ssoProviders} separator={false} />
            )}

            {state === 'logged-out' && !ssoRequired && (
                <>
                    <SsoButtons providers={ssoProviders} />

                    <Button asChild size="lg" className="w-full">
                        <Link href={login()}>
                            <span className="truncate">{t('Sign in')}</span>
                        </Link>
                    </Button>

                    {canRegister && (
                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="w-full"
                        >
                            <Link href={register()}>
                                <span className="truncate">
                                    {t('Create an account')}
                                </span>
                            </Link>
                        </Button>
                    )}
                </>
            )}

            {state === 'join' && (
                <>
                    {user !== null && (
                        <div
                            data-slot="invite-link-account"
                            className="flex min-w-0 items-center gap-2"
                        >
                            <PersonAvatar
                                name={user.name}
                                src={user.avatarUrl}
                                size="lg"
                                decorative
                            />
                            <span className="flex min-w-0 flex-col">
                                <span className="text-sm font-title break-words">
                                    {t('Join :team as :name?', {
                                        team: team.name,
                                        name: user.name,
                                    })}
                                </span>
                                <span className="text-xs break-all text-muted-foreground">
                                    {user.email}
                                </span>
                            </span>
                        </div>
                    )}

                    <Form
                        {...InviteLinkMembershipsController.store.form(token)}
                        className="flex min-w-0"
                    >
                        {({ processing }) => (
                            <LoadingButton
                                type="submit"
                                size="lg"
                                className="w-full min-w-0"
                                loading={processing}
                                data-test="join-by-link-button"
                            >
                                <span className="truncate">
                                    {t('Join :team', { team: team.name })}
                                </span>
                            </LoadingButton>
                        )}
                    </Form>

                    <p className="text-xs text-muted-foreground">
                        {t('Not you?')}{' '}
                        <Link
                            href={logout()}
                            as="button"
                            className={authLinkClass}
                        >
                            {t('Switch account')}
                        </Link>
                    </p>
                </>
            )}
        </Card>
    );
}
