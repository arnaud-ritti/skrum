import { OnboardingPage } from '@/components/onboarding/onboarding-page';
import type { OnboardingProps } from '@/components/onboarding/onboarding-page';

export default function ShowOnboarding(props: OnboardingProps) {
    return <OnboardingPage {...props} />;
}
