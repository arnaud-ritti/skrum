import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { SettingsCard } from '@/components/settings/settings-card';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { TeamSummary } from '@/types';

type Props = {
    workspaceSlug: string;
    team: TeamSummary;
};

/** The danger zone of the General tab: rendered for who may delete the team. */
export function TeamSettingsCard({ workspaceSlug, team }: Props) {
    const { t } = useTrans();
    const [deleting, setDeleting] = useState(false);

    const destroy = (): Promise<void> =>
        new Promise((resolve) => {
            router.delete(
                TeamsController.destroy.url({
                    workspace: workspaceSlug,
                    team: team.id,
                }),
                { onFinish: () => resolve() },
            );
        });

    return (
        <div data-slot="team-settings" className="min-w-0">
            <SettingsCard
                tone="destructive"
                title={t('Delete team')}
                description={t(
                    'This permanently deletes the team and its retrospectives.',
                )}
            >
                <Button variant="destructive" onClick={() => setDeleting(true)}>
                    <Trash2 aria-hidden />
                    <span className="truncate">{t('Delete team')}</span>
                </Button>
            </SettingsCard>

            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                tone="destructive"
                title={t('Delete this team?')}
                description={t(
                    'This permanently deletes the team and its retrospectives.',
                )}
                confirmLabel={t('Delete team')}
                onConfirm={destroy}
            />
        </div>
    );
}
