import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

export default function PokerEstimates() {
    const { t } = useTrans();

    return <Head title={t('Estimation history')} />;
}
