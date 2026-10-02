import { Form, Head, Link, usePage } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { TeamSummary, WorkspaceSummary, WorkspaceTeamTile } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    teams: (TeamSummary | WorkspaceTeamTile)[];
    membersCount?: number;
    adminsCount?: number;
    canManage: boolean;
};

export default function ShowWorkspace({ workspace, teams, canManage }: Props) {
    const { t } = useTrans();
    const { auth } = usePage().props;

    return (
        <>
            <Head title={workspace.name} />
            <div className="space-y-6 p-4">
                <Heading
                    title={workspace.name}
                    description={t('Teams in this workspace')}
                />

                {canManage && (
                    <Form
                        {...TeamsController.store.form(workspace.slug)}
                        resetOnSuccess
                        className="flex max-w-md items-start gap-2"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="flex-1">
                                    <Input
                                        name="name"
                                        required
                                        maxLength={100}
                                        placeholder={t('New team name')}
                                        aria-label={t('New team name')}
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <Button disabled={processing}>
                                    {t('Create team')}
                                </Button>
                            </>
                        )}
                    </Form>
                )}

                {teams.length === 0 && (
                    <p className="text-muted-foreground">
                        {canManage
                            ? t('No teams yet. Create the first one.')
                            : t('You are not a member of any team yet.')}
                    </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {teams.map((team) => (
                        <Link
                            key={team.id}
                            href={TeamsController.show({
                                workspace: workspace.slug,
                                team: team.id,
                            })}
                        >
                            <Card className="transition hover:border-primary">
                                <CardHeader>
                                    <CardTitle>{team.name}</CardTitle>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>

                <Form
                    {...WorkspaceMembersController.destroy.form({
                        workspace: workspace.slug,
                        member: auth.user.id,
                    })}
                >
                    {({ processing, errors }) => (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={processing}
                            >
                                {t('Leave workspace')}
                            </Button>
                            <InputError message={errors.member} />
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
