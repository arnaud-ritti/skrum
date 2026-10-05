import { BenchSample, benchSidebar } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { AppFrame, SettingsFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

export default function SettingsSection() {
    const { t } = useTrans();
    const href = '/dev/design-system/settings';

    return (
        <AppFrame
            sidebar={{ ...benchSidebar, active: 'settings' }}
            topbar={<AppTopbar title={t('Settings')} />}
        >
            <SettingsFrame
                title={t('Team settings')}
                description={t('Members, rituals and integrations')}
                navLabel={t('Settings')}
                nav={[
                    { label: t('General'), href, current: true },
                    { label: t('Members & rituals'), href, current: false },
                    { label: t('Integrations'), href, current: false },
                    { label: t('Data & export'), href, current: false },
                ]}
            >
                <BenchSample label="SettingsLayout" />
            </SettingsFrame>
        </AppFrame>
    );
}
