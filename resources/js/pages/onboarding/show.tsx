import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import OnboardingLayout from '@/layouts/skrum/onboarding-layout';

export default function ShowOnboarding() {
    const { t } = useTrans();

    return (
        <OnboardingLayout>
            <Head title={t('Getting started')} />
        </OnboardingLayout>
    );
}
