import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { TeamSummary } from '@/types';

type Props = {
    workspaceSlug: string;
    team: TeamSummary;
};

/** Rename and delete the team: rendered for who may manage it. */
export function TeamSettingsCard({ workspaceSlug, team }: Props) {
    const { t } = useTrans();
    const headingId = useId();
    const errorId = useId();
    const params = { workspace: workspaceSlug, team: team.id };
    const [name, setName] = useState(team.name);
    const [error, setError] = useState<string | undefined>(undefined);
    const [renaming, setRenaming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const rename = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();

        if (renaming) {
            return;
        }

        router.patch(
            TeamsController.update.url(params),
            { name },
            {
                preserveScroll: true,
                onStart: () => setRenaming(true),
                onSuccess: () => setError(undefined),
                onError: (errors) => setError(errors.name),
                onFinish: () => setRenaming(false),
            },
        );
    };

    const destroy = (): Promise<void> =>
        new Promise((resolve) => {
            router.delete(TeamsController.destroy.url(params), {
                onFinish: () => resolve(),
            });
        });

    return (
        <Card asChild>
            <section data-slot="team-settings" aria-labelledby={headingId}>
                <CardHeader>
                    <h2
                        id={headingId}
                        className="text-base leading-snug font-title"
                    >
                        {t('Team settings')}
                    </h2>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <form onSubmit={rename} className="flex flex-col gap-1">
                        <div className="flex min-w-0 items-start gap-2">
                            <Input
                                name="name"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                required
                                maxLength={100}
                                aria-label={t('Team name')}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? errorId : undefined}
                                className="min-w-0 flex-1"
                            />
                            <LoadingButton
                                type="submit"
                                variant="outline"
                                loading={renaming}
                            >
                                {t('Rename')}
                            </LoadingButton>
                        </div>
                        {error && (
                            <p
                                id={errorId}
                                role="alert"
                                className="text-body-sm text-skrum-destructive-text"
                            >
                                {error}
                            </p>
                        )}
                    </form>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4">
                        <p className="min-w-40 flex-1 text-body-sm text-muted-foreground">
                            {t(
                                'This permanently deletes the team and its retrospectives.',
                            )}
                        </p>
                        <Button
                            variant="destructive"
                            onClick={() => setDeleting(true)}
                        >
                            <Trash2 aria-hidden />
                            <span className="truncate">{t('Delete team')}</span>
                        </Button>
                    </div>
                </CardContent>

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
            </section>
        </Card>
    );
}
