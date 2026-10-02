import type { ReactNode } from 'react';
import { SettingsFrame } from '@/components/skrum/frames';
import type { SubNavItem } from '@/components/skrum/sub-nav';
import { useTrans } from '@/hooks/use-trans';

export default function SettingsLayout({
    title,
    description,
    nav,
    navLabel,
    children,
}: {
    title: string;
    description?: string;
    nav: SubNavItem[];
    /** Accessible name of the sub-navigation; "Settings" when absent. */
    navLabel?: string;
    children: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <SettingsFrame
            title={title}
            description={description}
            nav={nav}
            navLabel={navLabel ?? t('Settings')}
        >
            {children}
        </SettingsFrame>
    );
}
