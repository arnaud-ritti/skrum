import { Form, Head } from '@inertiajs/react';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import ConfirmFormDialog from '@/components/confirm-form-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { MemberSummary, TeamSummary, WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    members: MemberSummary[];
    availableMembers: MemberSummary[];
    canManage: boolean;
};

export default function ShowTeam({
    workspace,
    team,
    members,
    availableMembers,
    canManage,
}: Props) {
    const { t } = useTrans();
    const params = { workspace: workspace.slug, team: team.id };

    return (
        <>
            <Head title={team.name} />
            <div className="max-w-2xl space-y-8 p-4">
                <Heading
                    title={team.name}
                    description={t('Retrospectives will appear here.')}
                />

                {canManage && (
                    <Form
                        {...TeamsController.update.form(params)}
                        className="flex items-start gap-2"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="flex-1">
                                    <Input
                                        name="name"
                                        defaultValue={team.name}
                                        required
                                        maxLength={100}
                                        aria-label={t('Team name')}
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <Button variant="outline" disabled={processing}>
                                    {t('Rename')}
                                </Button>
                            </>
                        )}
                    </Form>
                )}

                <section className="space-y-3">
                    <Heading variant="small" title={t('Members')} />
                    <ul className="divide-y rounded-md border">
                        {members.map((member) => (
                            <li
                                key={member.id}
                                className="flex items-center justify-between p-3"
                            >
                                <div>
                                    <div className="font-medium">
                                        {member.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {member.email}
                                    </div>
                                </div>
                                {canManage && (
                                    <Form
                                        {...TeamMembersController.destroy.form({
                                            ...params,
                                            member: member.id,
                                        })}
                                    >
                                        {({ processing }) => (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={processing}
                                            >
                                                {t('Remove')}
                                            </Button>
                                        )}
                                    </Form>
                                )}
                            </li>
                        ))}
                    </ul>

                    {canManage && availableMembers.length > 0 && (
                        <Form
                            {...TeamMembersController.store.form(params)}
                            className="flex items-start gap-2"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="flex-1">
                                        <Select name="user_id">
                                            <SelectTrigger
                                                aria-label={t('Add a member')}
                                            >
                                                <SelectValue
                                                    placeholder={t(
                                                        'Add a member',
                                                    )}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableMembers.map(
                                                    (member) => (
                                                        <SelectItem
                                                            key={member.id}
                                                            value={member.id}
                                                        >
                                                            {member.name}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.user_id} />
                                    </div>
                                    <Button disabled={processing}>
                                        {t('Add')}
                                    </Button>
                                </>
                            )}
                        </Form>
                    )}
                </section>

                {canManage && (
                    <ConfirmFormDialog
                        form={TeamsController.destroy.form(params)}
                        title={t('Delete this team?')}
                        description={t(
                            'This permanently deletes the team and its retrospectives.',
                        )}
                        confirmLabel={t('Delete team')}
                        trigger={
                            <Button variant="destructive">
                                {t('Delete team')}
                            </Button>
                        }
                    />
                )}
            </div>
        </>
    );
}
