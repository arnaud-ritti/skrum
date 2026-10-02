import { Form } from '@inertiajs/react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';

export const WorkspaceNameMaxLength = 100;

/**
 * The first step of the onboarding mockup, with what the server holds: the
 * name. The logo and the default language are not workspace data (ON-1).
 */
export function CreateWorkspaceForm({
    autoFocus = true,
}: {
    /** Off on the bench, where several forms share a page. */
    autoFocus?: boolean;
}) {
    const { t } = useTrans();

    return (
        <Card
            data-slot="create-workspace"
            className="mx-auto w-full max-w-md gap-5 p-6"
        >
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-xl font-title tracking-heading">
                    {t('Name your workspace')}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {t(
                        'The workspace groups your teams, templates and members.',
                    )}
                </p>
            </div>
            <Form
                {...WorkspacesController.store.form()}
                className="flex flex-col gap-4"
            >
                {({ processing, errors }) => (
                    <>
                        <TextField
                            id="name"
                            name="name"
                            label={t('Workspace name')}
                            required
                            autoFocus={autoFocus}
                            maxLength={WorkspaceNameMaxLength}
                            error={errors.name}
                        />
                        <LoadingButton
                            type="submit"
                            loading={processing}
                            className="self-start"
                        >
                            {t('Create workspace')}
                        </LoadingButton>
                    </>
                )}
            </Form>
        </Card>
    );
}
