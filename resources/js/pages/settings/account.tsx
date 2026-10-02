import { Head } from '@inertiajs/react';
import { AccountSettings } from '@/components/settings/account-settings';
import type { AccountSettingsProps } from '@/components/settings/account-settings';
import { useTrans } from '@/hooks/use-trans';

export default function Account(props: AccountSettingsProps) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Settings')} />

            <AccountSettings {...props} />
        </>
    );
}
