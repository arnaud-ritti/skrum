import { Form, Link } from '@inertiajs/react';
import { Check } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Alert } from '@/components/ui/alert';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { send } from '@/routes/verification';

type ProfileUser = {
    name: string;
    email: string;
    email_verified_at: string | null;
    avatarUrl: string;
};

type ProfileCardProps = {
    user: ProfileUser;
    mustVerifyEmail: boolean;
    status?: string;
    /** The presence colour the avatar wears, the one chosen before it is saved. */
    presence?: AvatarPresence;
    /** Place left beside the avatar for the presence colours (AC-4). */
    presenceColours?: ReactNode;
    /** Place left beside the avatar, under the colours, for the photo (AC-1). */
    photo?: ReactNode;
};

export function ProfileCard({
    user,
    mustVerifyEmail,
    status,
    presence,
    presenceColours,
    photo,
}: ProfileCardProps): ReactElement {
    const { t } = useTrans();
    const verified = user.email_verified_at !== null;
    const hasIdentity = presenceColours !== undefined || photo !== undefined;

    return (
        <Form
            {...ProfileController.update.form()}
            options={{ preserveScroll: true }}
            data-slot="profile-card"
            className="min-w-0"
        >
            {({ processing, errors }) => (
                <SettingsCard
                    title={t('Profile')}
                    description={t(
                        'How teammates see you in sessions and on cards.',
                    )}
                    footer={
                        <>
                            {mustVerifyEmail && (
                                <p className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
                                    {t(
                                        'A changed email address has to be verified again.',
                                    )}
                                </p>
                            )}
                            <LoadingButton
                                type="submit"
                                size="sm"
                                loading={processing}
                                data-test="update-profile-button"
                                className="max-w-full"
                            >
                                <span className="truncate">{t('Save')}</span>
                            </LoadingButton>
                        </>
                    }
                >
                    <div className="flex flex-wrap items-start gap-5">
                        <PersonAvatar
                            name={user.name}
                            src={user.avatarUrl}
                            presence={presence}
                            size="xl"
                            decorative
                        />
                        {hasIdentity && (
                            <div
                                data-slot="profile-identity"
                                className="flex min-w-0 flex-1 basis-80 flex-col gap-2"
                            >
                                {presenceColours}
                                {photo}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">
                        <TextField
                            id="name"
                            name="name"
                            label={t('Name')}
                            defaultValue={user.name}
                            required
                            autoComplete="name"
                            placeholder={t('Full name')}
                            error={errors.name}
                        />
                        <TextField
                            id="email"
                            name="email"
                            type="email"
                            label={t('Email')}
                            defaultValue={user.email}
                            required
                            autoComplete="username"
                            error={errors.email}
                            className={verified ? 'pr-28' : undefined}
                            suffix={
                                verified ? (
                                    <Badge
                                        variant="success"
                                        shape="pill"
                                        icon={Check}
                                        data-slot="profile-email-verified"
                                    >
                                        {t('Verified')}
                                    </Badge>
                                ) : undefined
                            }
                        />
                    </div>

                    {mustVerifyEmail && !verified && (
                        <Alert
                            variant="warning"
                            title={t('Your email address is unverified.')}
                            description={
                                <Link
                                    href={send()}
                                    as="button"
                                    className="rounded-sm text-left underline underline-offset-4"
                                >
                                    {t(
                                        'Click here to re-send the verification email.',
                                    )}
                                </Link>
                            }
                        />
                    )}

                    {mustVerifyEmail &&
                        !verified &&
                        status === 'verification-link-sent' && (
                            <Alert
                                variant="success"
                                title={t(
                                    'A new verification link has been sent to your email address.',
                                )}
                            />
                        )}
                </SettingsCard>
            )}
        </Form>
    );
}
