import { Head } from '@inertiajs/react';
import { AboutContent } from '@/components/about/about-content';
import type { AboutContentProps } from '@/components/about/about-content';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function About(props: AboutContentProps) {
    const { t } = useTrans();

    return (
        <AppLayout title={t('About')}>
            <Head title={t('About')} />
            <AboutContent {...props} />
        </AppLayout>
    );
}
