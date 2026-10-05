import { Head } from '@inertiajs/react';
import { InviteLinkCard } from '@/components/auth/invite-link-card';
import type { InviteLinkProps } from '@/components/auth/invite-link-card';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ShowInviteLink(props: InviteLinkProps) {
    const { t } = useTrans();
    const title =
        props.isInvalid || !props.isUsable || props.teamName === undefined
            ? t('Invitation')
            : t('Join :team', { team: props.teamName });

    return (
        <AuthLayout variant="centered" title={title}>
            <Head title={t('Invitation')} />
            <InviteLinkCard {...props} />
        </AuthLayout>
    );
}
