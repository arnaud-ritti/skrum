import { Head, usePage } from '@inertiajs/react';
import { useRef } from 'react';
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

    return (
        <>
            <Head title={t('Branding')} />
            <BrandingForm
                key={signature}
                focusOnMount={signature !== firstSignature.current}
                adminName={auth.user.name}
                frame={(bar, content) => (
                    <AdminShell active="branding" actions={bar}>
                        {content}
                    </AdminShell>
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
        </>
    );
}
