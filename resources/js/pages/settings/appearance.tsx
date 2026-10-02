import { Head, usePage } from '@inertiajs/react';
import { AppearanceCard } from '@/components/settings/appearance/appearance-card';
import { ShortcutPreferenceCard } from '@/components/settings/appearance/shortcut-preference-card';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTrans } from '@/hooks/use-trans';

export default function Appearance() {
    const { t } = useTrans();
    const { auth } = usePage().props;

    return (
        <SettingsShell active="appearance">
            <Head title={t('Appearance settings')} />

            <AppearanceCard
                accessibility={
                    <ShortcutPreferenceCard
                        enabled={auth.user.single_key_shortcuts !== false}
                    />
                }
            />
        </SettingsShell>
    );
}
