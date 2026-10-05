import { router } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { SettingsCard } from '@/components/settings/settings-card';
import { AvatarStylePicker } from '@/components/skrum/avatar-style-picker';
import type { AvatarStyleOption } from '@/components/skrum/avatar-style-picker';
import { LoadingButton } from '@/components/skrum/loading-button';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type ProfileAvatarStyle = {
    value: string;
    name: string;
    license: string;
    attribution: string | null;
    attributionRequired: boolean;
    sampleUrls: string[];
};

type Props = {
    user: { name: string; email: string; avatarUrl?: string };
    memberChoice: boolean;
    /** The member's own choice; null follows the instance style. */
    style: string | null;
    instanceStyle: string;
    styles: ProfileAvatarStyle[];
};

function toOption(style: ProfileAvatarStyle): AvatarStyleOption {
    return {
        value: style.value,
        name: style.name,
        license: style.license,
        attribution:
            style.attributionRequired && style.attribution !== null
                ? style.attribution
                : undefined,
        sampleUrls: style.sampleUrls,
    };
}

export function AvatarStyleCard({
    user,
    memberChoice,
    style,
    instanceStyle,
    styles,
}: Props) {
    const { t } = useTrans();
    const [selected, setSelected] = useState(style ?? instanceStyle);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();

    if (!memberChoice) {
        const instanceStyleName =
            styles.find((option) => option.value === instanceStyle)?.name ??
            instanceStyle;

        return (
            <div data-slot="avatar-style-card" className="min-w-0">
                <SettingsCard title={t('Avatar style')}>
                    <div
                        data-slot="avatar-style-locked"
                        className="flex min-w-0 flex-wrap items-center gap-3"
                    >
                        <PersonAvatar
                            name={user.name}
                            src={user.avatarUrl}
                            imgProps={{ alt: '' }}
                            size="xl"
                            decorative
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-semibold">
                                {t('My avatar')}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                {t(':style · Style set by the administrator', {
                                    style: instanceStyleName,
                                })}
                            </span>
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            className="max-w-full"
                        >
                            <Lock aria-hidden />
                            <span className="truncate">
                                {t('Style set by the instance')}
                            </span>
                        </Button>
                    </div>
                </SettingsCard>
            </div>
        );
    }

    const save = (avatarStyle: string | null): void => {
        setError(undefined);

        router.patch(
            ProfileController.update.url(),
            { name: user.name, email: user.email, avatar_style: avatarStyle },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => {
                    if (avatarStyle === null) {
                        setSelected(instanceStyle);
                    }
                },
                onError: (errors) =>
                    setError(
                        errors.avatar_style ??
                            Object.values(errors)[0] ??
                            t('Something went wrong. Please try again.'),
                    ),
            },
        );
    };

    return (
        <div data-slot="avatar-style-card" className="min-w-0">
            <SettingsCard
                title={t('Avatar style')}
                description={t('Choose how your avatar is drawn everywhere.')}
                footer={
                    <>
                        {style !== null && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={processing}
                                onClick={() => save(null)}
                                className="max-w-full"
                            >
                                <span className="truncate">
                                    {t('Use the instance style')}
                                </span>
                            </Button>
                        )}
                        <LoadingButton
                            type="button"
                            size="sm"
                            loading={processing}
                            disabled={selected === (style ?? instanceStyle)}
                            onClick={() => save(selected)}
                            data-test="update-avatar-style-button"
                            className="max-w-full"
                        >
                            <span className="truncate">
                                {t('Save avatar style')}
                            </span>
                        </LoadingButton>
                    </>
                }
            >
                <AvatarStylePicker
                    value={selected}
                    onChange={setSelected}
                    options={styles.map(toOption)}
                    sampleNames={[user.name]}
                />
                {error && (
                    <p
                        role="alert"
                        className="text-sm text-skrum-destructive-text"
                    >
                        {error}
                    </p>
                )}
            </SettingsCard>
        </div>
    );
}
