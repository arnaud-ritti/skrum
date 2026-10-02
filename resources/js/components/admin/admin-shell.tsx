import type { ReactNode } from 'react';
import AdminsController from '@/actions/App/Http/Controllers/Admin/AdminsController';
import BrandingController from '@/actions/App/Http/Controllers/Admin/BrandingController';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import SettingsLayout from '@/layouts/skrum/settings-layout';

export type AdminSection = 'branding' | 'admins';

export function AdminShell({
    active,
    children,
}: {
    active: AdminSection;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const sections: Record<AdminSection, string> = {
        branding: t('Branding'),
        admins: t('Admins'),
    };
    const routes = {
        branding: BrandingController.edit(),
        admins: AdminsController.index(),
    };

    return (
        <AppLayout
            active="admin"
            breadcrumbs={[
                { title: t('Administration'), href: routes.branding },
                { title: sections[active], href: routes[active] },
            ]}
        >
            <SettingsLayout
                title={t('Administration')}
                description={t('Settings that apply to the whole instance')}
                navLabel={t('Administration')}
                nav={[
                    {
                        label: sections.branding,
                        href: routes.branding,
                        current: active === 'branding',
                    },
                    {
                        label: sections.admins,
                        href: routes.admins,
                        current: active === 'admins',
                    },
                ]}
            >
                {children}
            </SettingsLayout>
        </AppLayout>
    );
}
