import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

export default function TeamSettingsPage() {
    const { t } = useTrans();

    return <Head title={t('Team settings')} />;
}
