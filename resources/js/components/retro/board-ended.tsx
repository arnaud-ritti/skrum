import { SessionShell } from '@/components/session/session-shell';
import { SessionTitle } from '@/components/session/session-title';
import { EmptyState } from '@/components/skrum/empty-state';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    reason: 'ended' | 'deleted';
    /** The retro's own title: written by a user, never translated. */
    title: string;
    teamUrl: string | null;
};

/** The board is gone for this viewer: the shell keeps its title, nothing else. */
export function BoardEnded({ reason, title, teamUrl }: Props) {
    const { t } = useTrans();

    return (
        <SessionShell
            kind="retro"
            title={
                <SessionTitle backHref={teamUrl} overline={t('Retrospective')}>
                    {title}
                </SessionTitle>
            }
            realtime="connecting"
            connection={{ reconnecting: false, expired: false }}
        >
            <div className="flex h-full items-center justify-center overflow-y-auto p-6">
                <EmptyState
                    module="retro"
                    title={
                        reason === 'deleted'
                            ? t('Retrospective deleted')
                            : t('Access ended')
                    }
                    description={
                        reason === 'deleted'
                            ? t('This retrospective has been deleted.')
                            : t('Your access to this retrospective has ended.')
                    }
                />
            </div>
        </SessionShell>
    );
}
