import { Head } from '@inertiajs/react';
import { InvitationCard } from '@/components/auth/invitation-card';
import type { InvitationProps } from '@/components/auth/invitation-card';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ShowInvitation(props: InvitationProps) {
    const { t } = useTrans();
    const title = props.isInvalid
        ? t('Invitation')
        : t('Join :workspace', { workspace: props.workspaceName ?? '' });

    return (
        <AuthLayout variant="centered" title={title} literalTitle>
            <Head title={t('Invitation')} />
            <InvitationCard {...props} />
        </AuthLayout>
    );
}
