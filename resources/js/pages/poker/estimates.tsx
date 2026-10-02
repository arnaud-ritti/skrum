import { Head } from '@inertiajs/react';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { EstimationHistory } from '@/components/poker/estimation-history';
import type { EstimationHistoryProps } from '@/components/poker/estimation-history';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

type Props = Omit<EstimationHistoryProps, 'actions' | 'extraFilters'>;

export default function PokerEstimates(props: Props) {
    const { t } = useTrans();
    const params = { workspace: props.workspace.slug, team: props.team.id };

    return (
        <AppLayout
            active="sessions"
            breadcrumbs={[
                { title: props.team.name, href: TeamsController.show(params) },
                {
                    title: t('Estimation history'),
                    href: TeamEstimatesController.index(params),
                },
            ]}
        >
            <Head title={t('Estimation history')} />
            <EstimationHistory {...props} />
        </AppLayout>
    );
}
