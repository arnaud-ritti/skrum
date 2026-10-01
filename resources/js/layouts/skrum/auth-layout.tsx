import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AuthFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';

export default function AuthLayout({
    title = '',
    description = '',
    aside,
    children,
}: {
    title?: string;
    description?: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <AuthFrame
            title={t(title)}
            description={t(description)}
            aside={aside}
            headerEnd={<LanguageSwitcher />}
        >
            {children}
        </AuthFrame>
    );
}
