import { Head, usePage } from '@inertiajs/react';
import { AvatarStyleCard } from '@/components/settings/avatar-style-card';
import type { ProfileAvatarStyle } from '@/components/settings/avatar-style-card';
import { DeleteAccountCard } from '@/components/settings/delete-account-card';
import { ProfileCard } from '@/components/settings/profile-card';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type { Auth } from '@/types';

export default function Profile({
    mustVerifyEmail,
    status,
    avatarMemberChoice = false,
    avatarStyle = null,
    instanceAvatarStyle = '',
    avatarStyles = [],
}: {
    mustVerifyEmail: boolean;
    status?: string;
    avatarMemberChoice?: boolean;
    avatarStyle?: string | null;
    instanceAvatarStyle?: string;
    avatarStyles?: ProfileAvatarStyle[];
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { t } = useTrans();

    return (
        <SettingsShell active="profile">
            <Head title={t('Profile settings')} />

            <div className="flex min-w-0 flex-col gap-4">
                <ProfileCard
                    user={auth.user}
                    mustVerifyEmail={mustVerifyEmail}
                    status={status}
                />
                <DeleteAccountCard />
            </div>

            <AvatarStyleCard
                user={auth.user}
                memberChoice={avatarMemberChoice}
                style={avatarStyle}
                instanceStyle={instanceAvatarStyle}
                styles={avatarStyles}
            />
        </SettingsShell>
    );
}
