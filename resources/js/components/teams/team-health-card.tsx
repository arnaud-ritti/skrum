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
import { useTrans } from '@/hooks/use-trans';
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
    onFinish: () => void;
};

/** The health check statements of a team, saved through the team's routes. */
export function TeamHealthCard({
    workspaceSlug,
    teamId,
    statements,
    canManage,
}: Props) {
    const { t } = useTrans();
    const params = { workspace: workspaceSlug, team: teamId };
    const [addErrors, setAddErrors] = useState<HealthStatementErrors>();
    const [editErrors, setEditErrors] = useState<HealthStatementErrors>();
    const [listError, setListError] = useState<string>();

    /**
     * Resolves to whether the server took the change. A visit that ends
     * without an answer (network, 419, 500) calls neither `onSuccess` nor
     * `onError`: `onFinish` settles it, with a message on the list.
     */
    const settle = (
        visit: (outcome: Outcome) => void,
        onRefused: (errors: Errors) => void,
    ): Promise<boolean> =>
        new Promise((resolve) => {
            let answered = false;

            visit({
                preserveScroll: true,
                onSuccess: () => {
                    answered = true;
                    setListError(undefined);
                    resolve(true);
                },
                onError: (errors) => {
                    answered = true;
                    onRefused(errors);
                    resolve(false);
                },
                onFinish: () => {
                    if (!answered) {
                        setListError(
                            t('Something went wrong. Please try again.'),
                        );
                    }

                    resolve(false);
                },
            });
        });

    const saveDraft = async (
        visit: (outcome: Outcome) => void,
        setErrors: (errors: HealthStatementErrors | undefined) => void,
    ): Promise<boolean> => {
        const saved = await settle(visit, (errors) =>
            setErrors({ text: errors.text, label: errors.label }),
        );

        if (saved) {
            setErrors(undefined);
        }

        return saved;
    };

    const changeList = (visit: (outcome: Outcome) => void): Promise<boolean> =>
        settle(visit, (errors) =>
            setListError(
                errors.statements ?? errors.ids ?? Object.values(errors)[0],
            ),
        );

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
                changeList((outcome) =>
                    router.put(
                        TeamHealthStatementOrdersController.update.url(params),
                        { ids },
                        outcome,
                    ),
                )
            }
            onAdd={add}
            onEdit={edit}
            onEditOpen={() => setEditErrors(undefined)}
            onArchive={(id) =>
                void changeList((outcome) =>
                    router.put(
                        TeamHealthStatementArchivalsController.update.url({
                            ...params,
                            statement: id,
                        }),
                        {},
                        outcome,
                    ),
                )
            }
            onRestore={(id) =>
                void changeList((outcome) =>
                    router.delete(
                        TeamHealthStatementArchivalsController.destroy.url({
                            ...params,
                            statement: id,
                        }),
                        outcome,
                    ),
                )
            }
            addErrors={addErrors}
            editErrors={editErrors}
            error={listError}
        />
    );
}
