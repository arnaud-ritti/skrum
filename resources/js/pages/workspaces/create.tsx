import { Form, Head } from '@inertiajs/react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';

export default function CreateWorkspace() {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Create a workspace')} />
            <div className="mx-auto w-full max-w-md space-y-6 p-4">
                <Heading
                    title={t('Create a workspace')}
                    description={t(
                        'A workspace groups your teams and their retrospectives.',
                    )}
                />
                <Form
                    {...WorkspacesController.store.form()}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">
                                    {t('Workspace name')}
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    autoFocus
                                    maxLength={100}
                                />
                                <InputError message={errors.name} />
                            </div>
                            <Button disabled={processing}>
                                {t('Create workspace')}
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
