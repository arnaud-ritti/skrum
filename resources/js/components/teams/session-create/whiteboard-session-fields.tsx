import { router } from '@inertiajs/react';
import { UserRoundPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import TeamWhiteboardsController from '@/actions/App/Http/Controllers/TeamWhiteboardsController';
import { SessionFormFooter } from '@/components/teams/session-create/new-session-dialog';
import type {
    SessionFormContext,
    WhiteboardSessionForm,
} from '@/components/teams/session-create/new-session-dialog';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import { WhiteboardTemplateGallery } from '@/components/teams/session-create/whiteboard-template-gallery';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardGalleryItem } from '@/types';

export type WhiteboardSessionFormProps = {
    workspaceSlug: string;
    /** Undefined until the page has loaded it: the form asks for it. */
    gallery?: WhiteboardGalleryItem[];
    disabledReason?: string;
    /** Name the form opens with. Default: empty. */
    initialTitle?: string;
    /** Beside "Create & open". A later plan passes "Schedule…" here. */
    secondaryAction?: ReactNode;
};

type Errors = Record<string, string>;

const BlankKey = 'blank';

/** The whiteboard form of the creation dialog, as `NewSessionDialog` takes it. */
export function whiteboardSessionForm(
    props: WhiteboardSessionFormProps,
): WhiteboardSessionForm {
    return {
        disabledReason: props.disabledReason,
        render: (context) => (
            <WhiteboardSessionFields {...props} context={context} />
        ),
    };
}

/** The item a link named (`?template=`), by its key or by its workspace template id; else Blank; else the first. */
export function initialTemplateKey(
    gallery: WhiteboardGalleryItem[],
    intentTemplate?: string,
): string | null {
    const named =
        intentTemplate === undefined
            ? undefined
            : gallery.find(
                  (item) =>
                      item.key === intentTemplate ||
                      item.workspaceTemplateId === intentTemplate,
              );

    return (
        named?.key ??
        gallery.find((item) => item.key === BlankKey)?.key ??
        gallery[0]?.key ??
        null
    );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
    if (message === undefined) {
        return null;
    }

    return (
        <p id={id} role="alert" className="text-xs text-skrum-destructive-text">
            {message}
        </p>
    );
}

export function WhiteboardSessionFields({
    workspaceSlug,
    gallery,
    initialTitle = '',
    secondaryAction,
    context,
}: WhiteboardSessionFormProps & {
    context: SessionFormContext;
}): ReactElement {
    const { t } = useTrans();
    const [title, setTitle] = useState(initialTitle);
    const [picked, setPicked] = useState<string | null>(null);
    const [guests, setGuests] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [processing, setProcessing] = useState(false);
    const loading = gallery === undefined;
    const items = gallery ?? [];
    const templateKey =
        picked !== null && items.some((item) => item.key === picked)
            ? picked
            : initialTemplateKey(items, context.intent?.template);
    const selected = items.find((item) => item.key === templateKey);

    useEffect(() => {
        if (loading) {
            router.reload({ only: ['whiteboardGallery'] });
        }
    }, [loading]);

    const submit = (event: FormEvent): void => {
        event.preventDefault();

        if (processing || selected === undefined || title.trim() === '') {
            return;
        }

        setErrors({});

        router.post(
            TeamWhiteboardsController.store({
                workspace: workspaceSlug,
                team: context.team.id,
            }).url,
            {
                title,
                ...(selected.workspaceTemplateId === null
                    ? { template: selected.key }
                    : { workspace_template_id: selected.workspaceTemplateId }),
                guest_access_enabled: guests,
            },
            {
                onStart: () => setProcessing(true),
                onSuccess: () => context.close(),
                onError: (failed) => setErrors(failed),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <form
            id={context.formId}
            data-slot="whiteboard-session-fields"
            onSubmit={submit}
            className="grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]"
        >
            <div className="flex min-w-0 flex-col gap-4 px-4 py-5 md:px-6">
                <div className="grid gap-2">
                    <Label htmlFor="whiteboard-title">{t('Name')}</Label>
                    <Input
                        id="whiteboard-title"
                        value={title}
                        maxLength={120}
                        required
                        autoFocus
                        aria-invalid={errors.title !== undefined || undefined}
                        aria-describedby="whiteboard-title-error"
                        onChange={(event) => setTitle(event.target.value)}
                    />
                    <FieldError
                        id="whiteboard-title-error"
                        message={errors.title}
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <span className="truncate text-sm font-semibold">
                        {t('Template')}
                    </span>
                    <WhiteboardTemplateGallery
                        items={items}
                        value={templateKey ?? ''}
                        onValueChange={setPicked}
                        loading={loading}
                        error={errors.template ?? errors.workspace_template_id}
                    />
                </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4 border-t bg-muted/45 px-4 py-5 md:border-t-0 md:border-l md:px-6">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">
                        {t('Invitation')}
                    </span>
                    <SettingRow
                        label={t('Anonymous guests allowed')}
                        htmlFor="new-whiteboard-guests"
                        help={t('Guests join with a nickname, no account')}
                        icon={UserRoundPlus}
                    >
                        <Switch
                            id="new-whiteboard-guests"
                            checked={guests}
                            onCheckedChange={setGuests}
                        />
                    </SettingRow>
                </div>
            </div>

            <SessionFormFooter
                context={context}
                processing={processing}
                disabled={selected === undefined}
                secondaryAction={secondaryAction}
            />
        </form>
    );
}
