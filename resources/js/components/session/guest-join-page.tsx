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

type GuestJoinPageProps = {
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
        /** Retro only (`PresentJoinSession::retro`). */
        hasAnonymousCards?: boolean;
    } | null;
    /** URL of the join POST (`RetroJoinsController.store.url(token)`, …). */
    storeUrl: string | null;
    /**
     * Nickname the field opens with: the name of a signed-in visitor, a random
     * one otherwise (`PresentJoinSession::nickname`). Read once: the server
     * draws another one on every visit, including the one after a refused join.
     */
    suggestedName?: string | null;
    /**
     * Colours already worn in the session (`PresentJoinSession::colours`).
     * The colour picker is only shown when the page sends this list.
     */
    takenColors?: number[];
    /** The visitor's own colour when it is still free. */
    suggestedPresence?: number | null;
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
        gameLabel: session.gameLabel,
        facilitator: session.facilitatorName || undefined,
        participants: session.participantsCount,
        status: session.isLive ? 'live' : undefined,
        anonymousCards: session.hasAnonymousCards || undefined,
    };
}

export function GuestJoinPage({
    kind,
    invalidTitle,
    session,
    storeUrl,
    suggestedName,
    takenColors,
    suggestedPresence,
    children,
    extraFields = [],
}: GuestJoinPageProps) {
    const { t } = useTrans();
    const { errors } = usePage().props;
    const isMobile = useIsMobile();
    const [processing, setProcessing] = useState(false);
    const [nickname, setNickname] = useState(suggestedName ?? undefined);
    const [drawingName, setDrawingName] = useState(false);
    const nameError = useMemo<GuestJoinProps['error']>(
        () => (errors?.name ? { field: 'name', message: errors.name } : null),
        [errors],
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

    const join: GuestJoinProps['onSubmit'] = ({ name, presence }, formData) => {
        const extras: Record<string, string> = {};

        for (const field of extraFields) {
            const value = formData.get(field);

            if (typeof value === 'string') {
                extras[field] = value;
            }
        }

        router.post(
            storeUrl,
            {
                name,
                ...(presence !== undefined ? { presence } : {}),
                ...extras,
            },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const drawName = () => {
        router.reload({
            only: ['randomName'],
            onStart: () => setDrawingName(true),
            onFinish: () => setDrawingName(false),
            onSuccess: (page) => {
                const { randomName } = page.props;

                if (typeof randomName === 'string' && randomName !== '') {
                    setNickname(randomName);
                }
            },
        });
    };

    return (
        <AuthLayout variant="centered" title={session.title} literalTitle>
            <GuestJoin
                session={toCardSession(kind, session)}
                initialName={nickname}
                takenColors={takenColors}
                initialPresence={suggestedPresence ?? undefined}
                swatchSize={isMobile ? 'lg' : 'md'}
                onRandomName={drawName}
                drawingName={drawingName}
                error={nameError}
                processing={processing}
                stickyAction={isMobile}
                onSubmit={join}
                loginUrl={login.url()}
                logo={false}
            >
                {children}
            </GuestJoin>
        </AuthLayout>
    );
}
