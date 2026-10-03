import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

export default function TeamMembersPage() {
    const { t } = useTrans();

    return <Head title={t('Members & rituals')} />;
}
