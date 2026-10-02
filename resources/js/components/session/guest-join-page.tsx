import { router, usePage } from '@inertiajs/react';
import { Link2Off } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessNotice } from '@/components/auth/access-notice';
import { GuestJoin } from '@/components/skrum/guest-join';
import type {
    GuestJoinProps,
    GuestJoinSessionKind,
} from '@/components/skrum/guest-join';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';
import { login } from '@/routes';

export type GuestJoinPageProps = {
    kind: GuestJoinSessionKind;
    /** Title of the page when the link is invalid: "Join a retrospective", … */
    invalidTitle: string;
    /** null: the guest link is no longer valid (the server answered 404). */
    session: {
        title: string;
        gameLabel?: string;
        facilitatorName?: string | null;
        participantsCount?: number;
        isLive?: boolean;
    } | null;
    /** URL of the join POST (`RetroJoinsController.store.url(token)`, …). */
    storeUrl: string | null;
    suggestedName?: string | null;
    /** Extra named controls, e.g. the poker `#spectator` switch. */
    children?: ReactNode;
    /** Extra fields of the POST body read from the form (`spectator`). */
    extraFields?: string[];
};

function toCardSession(
    kind: GuestJoinSessionKind,
    session: NonNullable<GuestJoinPageProps['session']>,
): GuestJoinProps['session'] {
    return {
        kind,
        title: session.title,
        ...(session.gameLabel !== undefined
            ? { gameLabel: session.gameLabel }
            : {}),
        ...(session.facilitatorName
            ? { facilitator: session.facilitatorName }
            : {}),
        ...(session.participantsCount !== undefined
            ? { participants: session.participantsCount }
            : {}),
        ...(session.isLive ? { status: 'live' as const } : {}),
    };
}

export function GuestJoinPage({
    kind,
    invalidTitle,
    session,
    storeUrl,
    suggestedName,
    children,
    extraFields = [],
}: GuestJoinPageProps) {
    const { t } = useTrans();
    const { errors } = usePage().props;
    const isMobile = useIsMobile();
    const [processing, setProcessing] = useState(false);
    const nameMessage = errors?.name;
    const nameError = useMemo<GuestJoinProps['error']>(
        () => (nameMessage ? { field: 'name', message: nameMessage } : null),
        [nameMessage],
    );

    if (session === null || storeUrl === null) {
        return (
            <AuthLayout variant="centered" title={invalidTitle}>
                <AccessNotice
                    icon={Link2Off}
                    title={invalidTitle}
                    description={t('This guest link is no longer valid.')}
                />
            </AuthLayout>
        );
    }

    const join: GuestJoinProps['onSubmit'] = ({ name }, formData) => {
        const extras: Record<string, string> = {};

        for (const field of extraFields) {
            const value = formData.get(field);

            if (typeof value === 'string') {
                extras[field] = value;
            }
        }

        router.post(
            storeUrl,
            { name, ...extras },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <AuthLayout variant="centered" title={session.title}>
            <GuestJoin
                session={toCardSession(kind, session)}
                initialName={suggestedName ?? undefined}
                error={nameError}
                processing={processing}
                stickyAction={isMobile}
                onSubmit={join}
                loginUrl={login.url()}
            >
                {children}
            </GuestJoin>
        </AuthLayout>
    );
}
