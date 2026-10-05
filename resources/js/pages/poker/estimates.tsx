import { Head } from '@inertiajs/react';
import { EstimationHistory } from '@/components/poker/estimation-history';
import type { EstimationHistoryProps } from '@/components/poker/estimation-history';
import { InsightsTabs } from '@/components/teams/insights-tabs';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

type Props = Omit<EstimationHistoryProps, 'actions' | 'extraFilters'>;

export default function PokerEstimates(props: Props) {
    const { t } = useTrans();
    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={t('Estimation history')} />
            <InsightsTabs
                workspace={props.workspace}
                team={props.team}
                active="estimates"
            />
            <EstimationHistory {...props} />
        </AppLayout>
    );
}
