import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminShell } from '@/components/admin/admin-shell';
import { GeneralSettingsForm } from '@/components/admin/general/general-settings-form';
import { useTrans } from '@/hooks/use-trans';
import type { GeneralSettingsPageProps } from '@/lib/admin/types';

/** Changes of these values mean the server stored something new. */
function formSignature(props: GeneralSettingsPageProps): string {
    return JSON.stringify([
        props.signupMode,
        props.allowedEmailDomains,
        props.updateCheckEnabled,
    ]);
}

export default function AdminGeneral(props: GeneralSettingsPageProps) {
    const { t } = useTrans();
    const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);

    /*
     * The form is remounted after each save, so that it starts again from
     * what the server stored. The shell stays outside it: the form sends its
     * bar into the topbar through a portal.
     */
    return (
        <AdminShell
            active="general"
            actions={<div ref={setBarSlot} className="contents" />}
        >
            <Head title={t('General')} />
            <GeneralSettingsForm
                key={formSignature(props)}
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
