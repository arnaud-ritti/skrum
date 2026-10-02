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
    literalTitle = false,
    children,
}: {
    title?: string;
    /** The title is content written by a user (a session name), not a label. */
    literalTitle?: boolean;
    description?: string;
    aside?: ReactNode;
    variant?: 'split' | 'centered';
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
            title={literalTitle ? title : t(title)}
            description={t(description)}
            aside={aside}
            variant={variant}
            headerEnd={<LanguageSwitcher />}
        >
            {children}
        </AuthFrame>
    );
}
