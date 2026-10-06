import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AuthFrame } from '@/components/skrum/frames';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { useTrans } from '@/hooks/use-trans';
import { showsPoweredBy } from '@/lib/brand';

/** Stands for the logo in the translated credit, so each language keeps its word order. */
const ProviderMark = '\u0000';

export default function AuthLayout({
    title = '',
    description = '',
    aside,
    variant = 'split',
    phoneIntro,
    children,
}: {
    title?: string;
    description?: string;
    aside?: ReactNode;
    variant?: 'split' | 'centered';
    phoneIntro?: string;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const { brand } = usePage().props;
    const [creditBefore, creditAfter = ''] = t('Powered by :provider', {
        provider: ProviderMark,
    }).split(ProviderMark);

    return (
        <AuthFrame
            brand={brand}
            footer={
                showsPoweredBy(brand) ? (
                    <span
                        data-slot="powered-by"
                        className="inline-flex items-center justify-center gap-1.5"
                    >
                        {creditBefore.trim()}
                        <SkrumLogo className="h-4 w-auto" />
                        {creditAfter.trim()}
                    </span>
                ) : undefined
            }
            title={title}
            description={description}
            aside={aside}
            variant={variant}
            phoneIntro={phoneIntro}
            headerEnd={<LanguageSwitcher />}
        >
            {children}
        </AuthFrame>
    );
}
