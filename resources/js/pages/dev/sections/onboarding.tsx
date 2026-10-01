import { BenchSample } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { OnboardingFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

export default function OnboardingSection() {
    const { t } = useTrans();

    return (
        <OnboardingFrame aside={<BenchSample label={t('Preview')} />}>
            <BenchSample label="OnboardingLayout" />
        </OnboardingFrame>
    );
}
