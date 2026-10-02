import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OnboardingFrame } from '@/components/skrum/frames';

export default function OnboardingLayout({
    stepper,
    aside,
    children,
}: {
    stepper?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
}) {
    const { brand } = usePage().props;

    return (
        <OnboardingFrame
            brand={brand}
            stepper={stepper}
            aside={aside}
            headerEnd={<LanguageSwitcher />}
        >
            {children}
        </OnboardingFrame>
    );
}
