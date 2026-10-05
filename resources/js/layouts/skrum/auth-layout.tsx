import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AuthFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';
import { showsPoweredBy } from '@/lib/brand';

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

    return (
        <AuthFrame
            brand={brand}
            footer={
                showsPoweredBy(brand)
                    ? t('Powered by :provider', { provider: 'Skrüm' })
                    : undefined
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
