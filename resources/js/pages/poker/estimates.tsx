import { Head } from '@inertiajs/react';
import { EstimationHistory } from '@/components/poker/estimation-history';
import type { EstimationHistoryProps } from '@/components/poker/estimation-history';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

type Props = Omit<EstimationHistoryProps, 'actions' | 'extraFilters'>;

export default function PokerEstimates(props: Props) {
    const { t } = useTrans();
    return (
        <AppLayout active="sessions" title={t('Estimation history')}>
            <Head title={t('Estimation history')} />
            <EstimationHistory {...props} />
        </AppLayout>
    );
}
