import { router } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import ProfilePhotosController from '@/actions/App/Http/Controllers/Settings/ProfilePhotosController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';
import { toSquareJpeg } from '@/lib/settings/square-crop';

const InitialsStyle = 'initials';

const CroppedTypes = ['image/jpeg', 'image/png'];

type ProfilePhotoProps = {
    /** The admin switch "Profile photos". */
    photosAllowed: boolean;
    hasPhoto: boolean;
    /** Members may choose their avatar style: the removal then goes back to initials. */
    memberChoice: boolean;
    /** The style the avatar draws without a photo. */
    style: string;
};

type Busy = 'upload' | 'remove' | null;

/**
 * "Upload photo" and the way back to a generated avatar, under the presence
 * colours. Each acts at once, outside the card's Save: its buttons never
 * submit the profile form and its file input has no name.
 */
export function ProfilePhoto({
    photosAllowed,
    hasPhoto,
    memberChoice,
    style,
}: ProfilePhotoProps): ReactElement | null {
    const { t } = useTrans();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<Busy>(null);
    const [error, setError] = useState<string>();

    if (!photosAllowed) {
        return null;
    }

    const showsRemoval = memberChoice
        ? hasPhoto || style !== InitialsStyle
        : hasPhoto;

    const upload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (file === undefined) {
            return;
        }

        setError(undefined);
        setBusy('upload');

        const photo = CroppedTypes.includes(file.type)
            ? await toSquareJpeg(file)
            : file;

        router.post(
            ProfilePhotosController.store.url(),
            { photo },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        errors.photo ??
                            t('Something went wrong. Please try again.'),
                    ),
                onFinish: () => setBusy(null),
            },
        );
    };

    const remove = () => {
        setError(undefined);

        router.delete(ProfilePhotosController.destroy.url(), {
            ...(memberChoice ? { data: { initials: true } } : {}),
            preserveScroll: true,
            onStart: () => setBusy('remove'),
            onError: (errors) =>
                setError(
                    errors.photo ??
                        errors.initials ??
                        t('Something went wrong. Please try again.'),
                ),
            onFinish: () => setBusy(null),
        });
    };

    return (
        <div data-slot="profile-photo" className="flex min-w-0 flex-col gap-2">
            <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png"
                data-slot="profile-photo-input"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => void upload(event)}
            />
            <div className="flex min-w-0 flex-wrap gap-2">
                <LoadingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={busy === 'upload'}
                    disabled={busy !== null}
                    onClick={() => input.current?.click()}
                    className="max-w-full"
                >
                    <Upload aria-hidden="true" />
                    <span className="truncate">{t('Upload photo')}</span>
                </LoadingButton>
                {showsRemoval && (
                    <LoadingButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={busy === 'remove'}
                        disabled={busy !== null}
                        onClick={remove}
                        className="max-w-full"
                    >
                        <span className="truncate">
                            {memberChoice
                                ? t('Use initials')
                                : t('Remove photo')}
                        </span>
                    </LoadingButton>
                )}
            </div>
            {error !== undefined && (
                <p
                    role="alert"
                    data-slot="profile-photo-error"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
