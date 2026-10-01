import type { ReactNode } from 'react';
import { SettingsFrame } from '@/components/skrum/frames';
import type { SubNavItem } from '@/components/skrum/sub-nav';
import { useTrans } from '@/hooks/use-trans';

export default function SettingsLayout({
    title,
    description,
    nav,
    children,
}: {
    title: string;
    description?: string;
    nav: SubNavItem[];
    children: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <SettingsFrame
            title={title}
            description={description}
            nav={nav}
            navLabel={t('Settings')}
        >
            {children}
        </SettingsFrame>
    );
}
