import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import JoinCodesController from '@/actions/App/Http/Controllers/JoinCodesController';
import { JoinCodeCard } from '@/components/sessions/join-code-card';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';
import { login } from '@/routes';

export default function JoinCode() {
    const { t } = useTrans();
    const { errors } = usePage().props;
    const isMobile = useIsMobile();
    const [processing, setProcessing] = useState(false);

    const send = (code: string) => {
        router.post(
            JoinCodesController.store.url(),
            { code },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <AuthLayout title={t('Join a session')} literalTitle variant="centered">
            <Head title={t('Join a session')} />
            <JoinCodeCard
                error={errors?.code ?? null}
                processing={processing}
                onSubmit={send}
                loginUrl={login.url()}
                stickyAction={isMobile}
                logo={false}
            />
        </AuthLayout>
    );
}
