import { Form, Link, usePage } from '@inertiajs/react';
import { Clock, Link2Off, Lock, LogOut } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import InvitationAcceptancesController from '@/actions/App/Http/Controllers/InvitationAcceptancesController';
import InvitationAccountsController from '@/actions/App/Http/Controllers/InvitationAccountsController';
import { AccessNotice } from '@/components/auth/access-notice';
import { authLinkClass } from '@/components/auth/auth-link';
import { PasswordField } from '@/components/auth/password-field';
import { minimumLength } from '@/components/auth/register-form';
import { SsoButtons } from '@/components/auth/sso-buttons';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Alert } from '@/components/ui/alert';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTrans } from '@/hooks/use-trans';
import { login, logout } from '@/routes';
import type { SsoProviderOption } from '@/types';

type InvitationPerson = {
    name: string;
    avatarUrl: string;
};

type InvitationRole = 'owner' | 'admin' | 'member';

/**
 * Props of the page `invitations/show`. An invalid token sends `isInvalid` alone; an expired or
 * used invitation sends `isExpired`, `workspaceName` and the name of the `inviter`, nothing else.
 */
export type InvitationProps = {
    isInvalid: boolean;
    token?: string;
    workspaceName?: string;
    email?: string;
    isExpired?: boolean;
    isLoggedIn?: boolean;
    emailMatches?: boolean;
    canRegister?: boolean;
    /** The server's password rule, sent to a visitor who may create the account on the card. */
    passwordRules?: string | null;
    /** Only single sign-on signs in: no account form, no link to the password page. */
    ssoRequired?: boolean;
    ssoProviders?: SsoProviderOption[];
    inviter?: (Pick<InvitationPerson, 'name'> & { avatarUrl?: string }) | null;
    role?: InvitationRole;
    expiresAt?: string;
    membersCount?: number;
    members?: InvitationPerson[];
};

type InvitationCardProps = InvitationProps & {
    /** Place of the team's mark, over the corner of the inviter's avatar (IN-1). */
    team?: ReactNode;
    /** Place of the inviter's message, under the members line (IN-2). */
    message?: ReactNode;
    /** Place of "Decline", beside the main action (IN-3). */
    decline?: ReactNode;
};

type InvitationState = 'logged-out' | 'accept' | 'wrong-account';

const ShownMembers = 3;

const Marker = /(\{\{(?:inviter|workspace)\}\})/;

function stateOf(isLoggedIn: boolean, emailMatches: boolean): InvitationState {
    if (!isLoggedIn) {
        return 'logged-out';
    }

    return emailMatches ? 'accept' : 'wrong-account';
}

export function InvitationCard({
    isInvalid,
    token = '',
    workspaceName = '',
    email = '',
    isExpired = false,
    isLoggedIn = false,
    emailMatches = false,
    canRegister = false,
    passwordRules = null,
    ssoRequired = false,
    ssoProviders = [],
    inviter = null,
    role,
    membersCount,
    members = [],
    team,
    message,
    decline,
}: InvitationCardProps) {
    const { t } = useTrans();
    const { auth } = usePage().props;
    const user = auth?.user ?? null;
    const minimum = minimumLength(passwordRules ?? '');

    if (isInvalid) {
        return (
            <AccessNotice
                icon={Link2Off}
                title={t('Invitation')}
                description={t('This invitation link is no longer valid.')}
            />
        );
    }

    if (isExpired) {
        return (
            <AccessNotice
                icon={Clock}
                tone="warning"
                title={t('Invitation')}
                description={t(
                    'Your invitation to join :workspace has expired or was already used.',
                    { workspace: workspaceName },
                )}
                hint={
                    inviter === null
                        ? t(
                              'Ask an administrator of :workspace for a new link.',
                              { workspace: workspaceName },
                          )
                        : t('Ask :name for a new link; nothing else to do.', {
                              name: inviter.name,
                          })
                }
            />
        );
    }

    const roleLabels: Record<InvitationRole, string> = {
        owner: t('Owner'),
        admin: t('Admin'),
        member: t('Member'),
    };
    const emphasised: Record<string, string> = {
        '{{inviter}}': inviter?.name ?? '',
        '{{workspace}}': workspaceName,
    };
    const sentence =
        inviter === null
            ? t('You are invited to join :workspace', {
                  workspace: '{{workspace}}',
              })
            : t(':inviter invited you to join :workspace', {
                  inviter: '{{inviter}}',
                  workspace: '{{workspace}}',
              });
    const state = stateOf(isLoggedIn, emailMatches);

    return (
        <Card
            data-slot="invitation-card"
            data-state={state}
            className="w-full min-w-0 gap-4 p-5 shadow-raised sm:p-8"
        >
            <div
                data-slot="invitation-who"
                className="flex min-w-0 flex-col items-center gap-3 text-center"
            >
                <span className="relative inline-flex">
                    {inviter === null ? (
                        <span
                            aria-hidden
                            className="flex size-14 items-center justify-center rounded-xl bg-skrum-primary-soft font-display text-xl font-bold text-skrum-primary-text"
                        >
                            {Array.from(workspaceName)[0]?.toUpperCase()}
                        </span>
                    ) : (
                        <PersonAvatar
                            name={inviter.name}
                            src={inviter.avatarUrl}
                            size="xl"
                            decorative
                        />
                    )}
                    {team !== undefined && (
                        <span
                            data-slot="invitation-team"
                            className="absolute -right-3.5 -bottom-1"
                        >
                            {team}
                        </span>
                    )}
                </span>
                <p
                    data-slot="invitation-sentence"
                    className="max-w-full text-lg/6.5 text-balance break-words"
                >
                    {sentence.split(Marker).map((part, index) =>
                        part in emphasised ? (
                            <b key={index} className="font-title">
                                {emphasised[part]}
                            </b>
                        ) : (
                            <Fragment key={index}>{part}</Fragment>
                        ),
                    )}
                </p>
                {role !== undefined && membersCount !== undefined && (
                    <div
                        data-slot="invitation-members"
                        className="flex max-w-full flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground"
                    >
                        <AvatarStack
                            people={members.map((member) => ({
                                name: member.name,
                                src: member.avatarUrl,
                            }))}
                            total={membersCount}
                            max={ShownMembers}
                            size="sm"
                            className="*:ring-card"
                        />
                        <span className="min-w-0">
                            {membersCount === 1
                                ? t('1 member · you join as :role', {
                                      role: roleLabels[role],
                                  })
                                : t(':count members · you join as :role', {
                                      count: membersCount,
                                      role: roleLabels[role],
                                  })}
                        </span>
                    </div>
                )}
                {message !== undefined && (
                    <div
                        data-slot="invitation-message"
                        className="max-w-full min-w-0"
                    >
                        {message}
                    </div>
                )}
            </div>

            <Separator />

            {state === 'logged-out' && ssoRequired && (
                <>
                    <SsoButtons providers={ssoProviders} separator={false} />
                    <p
                        data-slot="invitation-sso-account"
                        className="text-center text-sm break-words text-muted-foreground"
                    >
                        {t('Use the account whose address is :email.', {
                            email,
                        })}
                    </p>
                </>
            )}

            {state === 'logged-out' && !ssoRequired && canRegister && (
                <>
                    <SsoButtons providers={ssoProviders} />

                    <Form
                        {...InvitationAccountsController.store.form(token)}
                        resetOnSuccess={['password']}
                        disableWhileProcessing
                        data-slot="invitation-account-form"
                        className="flex min-w-0 flex-col gap-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <TextField
                                    id="email"
                                    type="email"
                                    label={t('Email')}
                                    value={email}
                                    readOnly
                                    autoComplete="username"
                                    description={t(
                                        'The invitation was sent to this address.',
                                    )}
                                    error={errors.email}
                                    suffix={
                                        <Lock
                                            aria-hidden
                                            className="mr-1.5 size-4 text-muted-foreground"
                                        />
                                    }
                                    className="bg-muted max-md:h-12"
                                />

                                <TextField
                                    id="name"
                                    name="name"
                                    type="text"
                                    label={t('First and last name')}
                                    required
                                    autoComplete="name"
                                    error={errors.name}
                                    className="max-md:h-12"
                                />

                                <PasswordField
                                    id="password"
                                    name="password"
                                    label={t('Create a password')}
                                    required
                                    autoComplete="new-password"
                                    passwordrules={passwordRules ?? undefined}
                                    placeholder={
                                        minimum === null
                                            ? undefined
                                            : t(':count characters minimum', {
                                                  count: minimum,
                                              })
                                    }
                                    error={errors.password}
                                    className="max-md:h-12"
                                />

                                <LoadingButton
                                    type="submit"
                                    size="lg"
                                    className="w-full min-w-0"
                                    loading={processing}
                                    data-test="create-invitation-account-button"
                                >
                                    <span className="truncate">
                                        {t(
                                            'Create my account and join :workspace',
                                            { workspace: workspaceName },
                                        )}
                                    </span>
                                </LoadingButton>
                            </>
                        )}
                    </Form>

                    <p className="text-center text-sm text-muted-foreground">
                        {t('Already have an account?')}{' '}
                        <Link href={login()} className={authLinkClass}>
                            {t('Sign in')}
                        </Link>
                    </p>
                </>
            )}

            {state === 'logged-out' && !ssoRequired && !canRegister && (
                <>
                    <SsoButtons providers={ssoProviders} />

                    <TextField
                        id="email"
                        type="email"
                        label={t('Email')}
                        value={email}
                        readOnly
                        description={t(
                            'The invitation was sent to this address.',
                        )}
                        suffix={
                            <Lock
                                aria-hidden
                                className="mr-1.5 size-4 text-muted-foreground"
                            />
                        }
                        className="bg-muted max-md:h-12"
                    />

                    <Button asChild size="lg" className="w-full">
                        <Link href={login()}>
                            <span className="truncate">{t('Log in')}</span>
                        </Link>
                    </Button>
                </>
            )}

            {state !== 'logged-out' && user !== null && (
                <div
                    data-slot="invitation-account"
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
                            {state === 'accept'
                                ? t('Join :workspace as :name?', {
                                      workspace: workspaceName,
                                      name: user.name,
                                  })
                                : user.name}
                        </span>
                        <span className="text-xs break-all text-muted-foreground">
                            {user.email}
                        </span>
                    </span>
                </div>
            )}

            {state === 'accept' && (
                <>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Form
                            {...InvitationAcceptancesController.store.form(
                                token,
                            )}
                            className="flex min-w-0 flex-1"
                        >
                            {({ processing }) => (
                                <LoadingButton
                                    type="submit"
                                    size="lg"
                                    className="w-full min-w-0"
                                    loading={processing}
                                    data-test="accept-invitation-button"
                                >
                                    <span className="truncate">
                                        {t('Join :workspace', {
                                            workspace: workspaceName,
                                        })}
                                    </span>
                                </LoadingButton>
                            )}
                        </Form>
                        {decline !== undefined && (
                            <span data-slot="invitation-decline">
                                {decline}
                            </span>
                        )}
                    </div>
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

            {state === 'wrong-account' && (
                <>
                    <Alert
                        variant="warning"
                        title={t(
                            'You are logged in with another email address. Log out and sign in as :email to accept.',
                            { email },
                        )}
                    />
                    <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="w-full"
                    >
                        <Link href={logout()} as="button">
                            <LogOut aria-hidden />
                            <span className="truncate">{t('Log out')}</span>
                        </Link>
                    </Button>
                </>
            )}

            {state === 'logged-out' && decline !== undefined && (
                <>
                    <Separator />
                    <div
                        data-slot="invitation-decline"
                        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center"
                    >
                        {decline}
                    </div>
                </>
            )}
        </Card>
    );
}
