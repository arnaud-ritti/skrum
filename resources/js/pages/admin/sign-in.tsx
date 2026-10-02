import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminShell } from '@/components/admin/admin-shell';
import { SignInSettingsForm } from '@/components/admin/sign-in-settings-form';
import type { SignInSettingsFormProps } from '@/components/admin/sign-in-settings-form';
import { useTrans } from '@/hooks/use-trans';

type Props = Omit<SignInSettingsFormProps, 'frame'>;

export default function SignInSettings(props: Props) {
    const { t } = useTrans();
    const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);

    return (
        <AdminShell
            active="signIn"
            actions={<div ref={setBarSlot} className="contents" />}
        >
            <Head title={t('SSO authentication')} />
            <SignInSettingsForm
                {...props}
                frame={(bar, content) => (
                    <>
                        {barSlot !== null && createPortal(bar, barSlot)}
                        {content}
                    </>
                )}
            />
        </AdminShell>
    );
}
