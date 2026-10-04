import type { ReactNode } from 'react';
import { InvitationCard } from '@/components/auth/invitation-card';
import type { InvitationProps } from '@/components/auth/invitation-card';
import type { BenchGroup } from '@/components/dev/bench';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

/** Names, a workspace and a message are written by users: not translated. */
const invitation: InvitationProps = {
    isInvalid: false,
    token: 'bench-token',
    workspaceName: 'Nordlys',
    email: 'nadia@nordlys.io',
    isExpired: false,
    isLoggedIn: false,
    emailMatches: false,
    canRegister: true,
    ssoProviders: [
        { key: 'oidc', label: 'SSO (OIDC)' },
        { key: 'google', label: 'Google' },
        { key: 'github', label: 'GitHub' },
    ],
    inviter: { name: 'Camille Roux', avatarUrl: '' },
    role: 'member',
    expiresAt: '2026-09-24T12:00:00+00:00',
    membersCount: 11,
    members: [
        { name: 'Théo Martin', avatarUrl: '' },
        { name: 'Inès Lopez', avatarUrl: '' },
        { name: 'Max Schmidt', avatarUrl: '' },
    ],
};

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function InvitationSection() {
    const { t } = useTrans();

    return (
        <div className="grid items-start gap-6 bg-skrum-canvas p-6 md:p-10 lg:grid-cols-2">
            <State label={t('Accept an invitation')}>
                <div className="w-full max-w-120">
                    <InvitationCard {...invitation} />
                </div>
            </State>
            <State label={t('Places left filled')}>
                <div className="w-full max-w-120">
                    <InvitationCard
                        {...invitation}
                        ssoProviders={[]}
                        canRegister={false}
                        team={{
                            name: 'Atlas',
                            initial: 'A',
                            color: 'lagoon',
                        }}
                        teamRole="member"
                        message="Retro for sprint 42 on Thursday at 2 pm, see you there."
                        declineUrl="#"
                    />
                </div>
            </State>
            <State label={t('Expired link')}>
                <InvitationCard {...invitation} isExpired />
            </State>
            <State label={t('Already used, inviter gone')}>
                <InvitationCard
                    {...invitation}
                    isExpired
                    inviter={null}
                    expiresAt="2999-01-01T12:00:00+00:00"
                />
            </State>
            <State label={t('Invitation declined')}>
                <InvitationCard {...invitation} isExpired isDeclined />
            </State>
            <State label={t('Invalid link')}>
                <InvitationCard isInvalid />
            </State>
        </div>
    );
}
