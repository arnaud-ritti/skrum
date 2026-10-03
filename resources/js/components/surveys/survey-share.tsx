import { Share2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { ShareDialog } from '@/components/skrum/share-dialog';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember } from '@/lib/retro/types';
import { surveyApi } from '@/lib/surveys/api';
import type { SurveyAction } from '@/lib/surveys/survey-reducer';
import type { SurveySnapshot } from '@/lib/surveys/types';

export const SurveyGuestAccessSwitchId = 'survey-guest-access';

/**
 * "Share" and its dialog: the guest link of a survey. A member copies it; an
 * editor also opens or closes guest access and replaces the link. Closing it
 * while a guest is answering ends that guest's access, so it asks first, as
 * the whiteboard does. A guest has no Share button.
 */
export function SurveyShare({
    snapshot,
    online,
    dispatch,
}: {
    snapshot: SurveySnapshot;
    online: readonly PresenceMember[];
    dispatch: Dispatch<SurveyAction>;
}) {
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const [confirmingGuestsOff, setConfirmingGuestsOff] = useState(false);
    const latest = useRef(snapshot);

    latest.current = snapshot;

    const { survey, me } = snapshot;

    if (me.isGuest) {
        return null;
    }

    const failed = (): void => {
        toast.error(t('Something went wrong. Please try again.'));
    };

    const copy = async (): Promise<boolean> => {
        if (!survey.guestUrl) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(survey.guestUrl);

            return true;
        } catch {
            failed();

            return false;
        }
    };

    const setGuestAccess = async (allowed: boolean): Promise<boolean> => {
        try {
            dispatch({
                type: 'snapshot.replace',
                snapshot: await surveyApi.update(survey.id, {
                    guest_access_enabled: allowed,
                }),
            });

            return true;
        } catch {
            failed();

            return false;
        }
    };

    const changeGuestAccess = (allowed: boolean): void => {
        if (!allowed && online.some((member) => member.isGuest)) {
            setConfirmingGuestsOff(true);

            return;
        }

        void setGuestAccess(allowed);
    };

    const turnGuestsOff = async (): Promise<void> => {
        if (!(await setGuestAccess(false))) {
            throw new Error('Guest access was not turned off.');
        }
    };

    const replaceLink = async (): Promise<void> => {
        try {
            const { guestUrl } = await surveyApi.newGuestLink(survey.id);
            const current = latest.current;

            dispatch({
                type: 'snapshot.replace',
                snapshot: {
                    ...current,
                    survey: { ...current.survey, guestUrl },
                },
            });
        } catch (error) {
            failed();

            throw error;
        }
    };

    return (
        <>
            <Button
                type="button"
                aria-label={t('Share')}
                onClick={() => setOpen(true)}
                className="shrink-0 max-lg:size-9 max-lg:px-0"
            >
                <Share2 aria-hidden />
                <span className="truncate max-lg:sr-only">{t('Share')}</span>
            </Button>
            <ShareDialog
                open={open}
                onOpenChange={setOpen}
                isMobile={isMobile}
                session={{
                    id: survey.id,
                    kind: 'survey',
                    title: survey.title,
                    teamName: survey.teamName ?? undefined,
                }}
                invite={{
                    url: survey.guestUrl,
                    allowGuests: survey.guestAccessEnabled,
                }}
                canManage={me.isEditor}
                guestSwitchId={SurveyGuestAccessSwitchId}
                onCopy={copy}
                onChange={({ allowGuests }) => {
                    if (allowGuests !== undefined) {
                        changeGuestAccess(allowGuests);
                    }
                }}
                onRegenerate={replaceLink}
            />
            <ConfirmDialog
                open={confirmingGuestsOff}
                onOpenChange={setConfirmingGuestsOff}
                tone="destructive"
                title={t('Turn off guest access?')}
                description={t('Guests answering this survey lose access.')}
                confirmLabel={t('Turn off guest access')}
                onConfirm={turnGuestsOff}
            />
        </>
    );
}
