import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import {
    ConfirmationLine,
    useFreshConfirmation,
} from '@/components/admin/configuration/confirmation-line';
import { MailSettingsCard } from '@/components/admin/mail/mail-settings-card';
import { useTrans } from '@/hooks/use-trans';
import type { MailSettingsPageProps } from '@/lib/admin/types';

export default function AdminMail({
    mail,
    lastTest,
    defaultRecipient,
    confirmedUntil,
    confirmUrl,
    updateUrl,
}: MailSettingsPageProps) {
    const { t } = useTrans();
    const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);
    const { needsConfirmation, refuse } = useFreshConfirmation(confirmedUntil);

    /* The card is remounted after a save, so that it starts again from what was stored. */
    return (
        <AdminShell
            active="mail"
            actions={<div ref={setBarSlot} className="contents" />}
        >
            <Head title={t('SMTP')} />
            <div className="flex max-w-3xl min-w-0 flex-col gap-8">
                <ConfirmationLine
                    visible={needsConfirmation}
                    confirmUrl={confirmUrl}
                />
                <MailSettingsCard
                    key={JSON.stringify([mail.delivering, mail.fields])}
                    mail={mail}
                    updateUrl={updateUrl}
                    lastTest={lastTest}
                    defaultRecipient={defaultRecipient}
                    needsConfirmation={needsConfirmation}
                    onConfirmationRefused={refuse}
                    barSlot={barSlot}
                />
            </div>
        </AdminShell>
    );
}
