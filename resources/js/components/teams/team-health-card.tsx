import { router } from '@inertiajs/react';
import { useState } from 'react';
import TeamHealthStatementArchivalsController from '@/actions/App/Http/Controllers/TeamHealthStatementArchivalsController';
import TeamHealthStatementOrdersController from '@/actions/App/Http/Controllers/TeamHealthStatementOrdersController';
import TeamHealthStatementsController from '@/actions/App/Http/Controllers/TeamHealthStatementsController';
import { HealthStatementsManager } from '@/components/skrum/health-check-manager';
import type {
    HealthStatementDraft,
    HealthStatementErrors,
} from '@/components/skrum/health-check-manager';
import type { TeamHealthStatement } from '@/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    statements: TeamHealthStatement[];
    canManage: boolean;
};

type Errors = Record<string, string>;

type Outcome = {
    preserveScroll: true;
    onSuccess: () => void;
    onError: (errors: Errors) => void;
};

/** The health check statements of a team, saved through the team's routes. */
export function TeamHealthCard({
    workspaceSlug,
    teamId,
    statements,
    canManage,
}: Props) {
    const params = { workspace: workspaceSlug, team: teamId };
    const [addErrors, setAddErrors] = useState<HealthStatementErrors>();
    const [editErrors, setEditErrors] = useState<HealthStatementErrors>();
    const [listError, setListError] = useState<string>();

    const saveDraft = (
        visit: (outcome: Outcome) => void,
        setErrors: (errors: HealthStatementErrors | undefined) => void,
    ): Promise<boolean> =>
        new Promise((resolve) => {
            visit({
                preserveScroll: true,
                onSuccess: () => {
                    setErrors(undefined);
                    resolve(true);
                },
                onError: (errors) => {
                    setErrors({ text: errors.text, label: errors.label });
                    resolve(false);
                },
            });
        });

    const listOutcome: Outcome = {
        preserveScroll: true,
        onSuccess: () => setListError(undefined),
        onError: (errors) =>
            setListError(
                errors.statements ?? errors.ids ?? Object.values(errors)[0],
            ),
    };

    const add = (draft: HealthStatementDraft): Promise<boolean> =>
        saveDraft(
            (outcome) =>
                router.post(
                    TeamHealthStatementsController.store.url(params),
                    { ...draft },
                    outcome,
                ),
            setAddErrors,
        );

    const edit = (id: string, draft: HealthStatementDraft): Promise<boolean> =>
        saveDraft(
            (outcome) =>
                router.patch(
                    TeamHealthStatementsController.update.url({
                        ...params,
                        statement: id,
                    }),
                    { ...draft },
                    outcome,
                ),
            setEditErrors,
        );

    return (
        <HealthStatementsManager
            statements={statements}
            canManage={canManage}
            onReorder={(ids) =>
                router.put(
                    TeamHealthStatementOrdersController.update.url(params),
                    { ids },
                    listOutcome,
                )
            }
            onAdd={add}
            onEdit={edit}
            onArchive={(id) =>
                router.put(
                    TeamHealthStatementArchivalsController.update.url({
                        ...params,
                        statement: id,
                    }),
                    {},
                    listOutcome,
                )
            }
            onRestore={(id) =>
                router.delete(
                    TeamHealthStatementArchivalsController.destroy.url({
                        ...params,
                        statement: id,
                    }),
                    listOutcome,
                )
            }
            addErrors={addErrors}
            editErrors={editErrors}
            error={listError}
        />
    );
}
