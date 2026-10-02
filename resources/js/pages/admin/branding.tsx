import { Head, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminShell } from '@/components/admin/admin-shell';
import { formSignature } from '@/components/admin/branding/branding';
import type { BrandingPageProps } from '@/components/admin/branding/branding';
import { BrandingForm } from '@/components/admin/branding/branding-form';
import { useTrans } from '@/hooks/use-trans';

export default function AdminBranding(props: BrandingPageProps) {
    const { t } = useTrans();
    const { auth } = usePage().props;
    const signature = formSignature(props);
    const firstSignature = useRef(signature);
    const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);

    /*
     * The form is remounted after each save. The shell stays outside it, so
     * the sidebar, the topbar and the bell keep their state: the form sends
     * its bar into the topbar through a portal.
     */
    return (
        <AdminShell
            active="branding"
            actions={<div ref={setBarSlot} className="contents" />}
        >
            <Head title={t('Branding')} />
            <BrandingForm
                key={signature}
                focusOnMount={signature !== firstSignature.current}
                adminName={auth.user.name}
                frame={(bar, content) => (
                    <>
                        {barSlot !== null && createPortal(bar, barSlot)}
                        {content}
                    </>
                )}
                brandColor={props.brandColor}
                brandRadius={props.brandRadius}
                displayName={props.displayName}
                poweredBy={props.poweredBy}
                avatarStyle={props.avatarStyle}
                avatarMemberChoice={props.avatarMemberChoice}
                gifProvider={props.gifProvider}
                gifEnabled={props.gifEnabled}
                gifRating={props.gifRating}
                hasGifKey={props.hasGifKey}
                defaults={props.defaults}
                assets={props.assets}
                palette={props.palette}
                avatarStyles={props.avatarStyles}
            />
        </AdminShell>
    );
}
