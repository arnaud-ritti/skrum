import { Head } from '@inertiajs/react';
import { AppearanceCard } from '@/components/settings/appearance/appearance-card';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTrans } from '@/hooks/use-trans';

export default function Appearance() {
    const { t } = useTrans();

    return (
        <SettingsShell active="appearance">
            <Head title={t('Appearance settings')} />

            <AppearanceCard />
        </SettingsShell>
    );
}
