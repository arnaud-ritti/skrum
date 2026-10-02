import { ArrowRight } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LoadingButton } from '@/components/skrum/loading-button';
import {
    SessionTypePicker,
    useDefaultSessionTypeOptions,
} from '@/components/skrum/session-type-picker';
import type { SessionTypeOption } from '@/components/skrum/session-type-picker';
import type {
    NewSessionIntent,
    SessionType,
} from '@/components/teams/session-create/use-new-session-intent';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';

/** What the dialog hands to the form of a type. */
export type SessionFormContext = {
    type: SessionType;
    /** Id of the `<form>` the footer's submit button belongs to. */
    formId: string;
    team: { id: string; name: string };
    /** The intent read from the URL, when it names this type. */
    intent: NewSessionIntent | null;
    /** False while another type is shown: the form keeps its state and renders no footer. */
    active: boolean;
    /** Where the active form renders its `SessionFormFooter`. */
    footer: HTMLElement | null;
    close: () => void;
};

/** The form of one session type. With `disabledReason` the type is shown disabled with that reason. */
export type SessionForm = {
    disabledReason?: string;
    render: (context: SessionFormContext) => ReactNode;
};

export type RetroSessionForm = SessionForm;
export type PokerSessionForm = SessionForm;
export type WhiteboardSessionForm = SessionForm;
export type IcebreakerSessionForm = SessionForm;

type NewSessionDialogProps = {
    trigger: ReactNode;
    team: { id: string; name: string };
    intent?: NewSessionIntent | null;
    retro?: RetroSessionForm;
    poker?: PokerSessionForm;
    whiteboard?: WhiteboardSessionForm;
    icebreaker?: IcebreakerSessionForm;
};

const typeOrder: readonly SessionType[] = [
    'retro',
    'poker',
    'whiteboard',
    'icebreaker',
];

type SessionFormFooterProps = {
    context: SessionFormContext;
    /** Left of the footer: an option of the form, such as "Save as team template". */
    start?: ReactNode;
    /** Beside "Create & open": a second way to finish, such as "Schedule…". */
    secondaryAction?: ReactNode;
    processing?: boolean;
    disabled?: boolean;
};

/** Rendered by the active form into the dialog's footer: Cancel and "Create & open". */
export function SessionFormFooter({
    context,
    start,
    secondaryAction,
    processing = false,
    disabled = false,
}: SessionFormFooterProps): ReactElement | null {
    const { t } = useTrans();

    if (!context.active || context.footer === null) {
        return null;
    }

    return createPortal(
        <>
            {start !== undefined && (
                <div
                    data-slot="session-footer-start"
                    className="min-w-0 max-md:basis-full"
                >
                    {start}
                </div>
            )}
            <span className="grow" />
            {secondaryAction}
            <Button
                type="button"
                variant="ghost"
                className="max-w-full"
                onClick={context.close}
            >
                <span className="truncate">{t('Cancel')}</span>
            </Button>
            <LoadingButton
                type="submit"
                form={context.formId}
                loading={processing}
                disabled={disabled}
                className="max-w-full"
            >
                <ArrowRight aria-hidden />
                <span className="truncate">{t('Create & open')}</span>
            </LoadingButton>
        </>,
        context.footer,
    );
}

function useTypeOptions(
    forms: Partial<Record<SessionType, SessionForm>>,
): SessionTypeOption[] {
    const { t } = useTrans();
    const defaults = useDefaultSessionTypeOptions();
    const descriptions: Record<SessionType, string> = {
        retro: t('Phases & cards'),
        poker: t('Estimate stories'),
        whiteboard: t('Free canvas'),
        icebreaker: t('Warm-up games'),
    };

    return typeOrder
        .filter((type) => forms[type] !== undefined)
        .map((type) => {
            const base = defaults.find((option) => option.value === type);

            return {
                value: type,
                label: base?.label ?? type,
                duration: base?.duration ?? '',
                description: descriptions[type],
                disabledReason: forms[type]?.disabledReason,
            };
        });
}

function firstType(
    forms: Partial<Record<SessionType, SessionForm>>,
    intent: NewSessionIntent | null,
): SessionType | null {
    const usable = typeOrder.filter(
        (type) =>
            forms[type] !== undefined &&
            forms[type]?.disabledReason === undefined,
    );

    if (intent !== null && usable.includes(intent.type)) {
        return intent.type;
    }

    return usable[0] ?? null;
}

function SessionDialogBody({
    team,
    intent,
    forms,
    initialType,
    mobile,
    close,
}: {
    team: { id: string; name: string };
    intent: NewSessionIntent | null;
    forms: Partial<Record<SessionType, SessionForm>>;
    initialType: SessionType;
    mobile: boolean;
    close: () => void;
}) {
    const options = useTypeOptions(forms);
    const formIdPrefix = useId();
    const [type, setType] = useState<SessionType>(initialType);
    const [visited, setVisited] = useState<SessionType[]>([initialType]);
    const [footer, setFooter] = useState<HTMLElement | null>(null);

    const selectType = (next: SessionType): void => {
        setType(next);
        setVisited((current) =>
            current.includes(next) ? current : [...current, next],
        );
    };

    const picker = (
        <SessionTypePicker
            variant="inline"
            value={type}
            options={options}
            onValueChange={(next) => selectType(next as SessionType)}
        />
    );

    return (
        <>
            {!mobile && (
                <div
                    data-slot="session-types"
                    className="shrink-0 border-b px-6 pb-4"
                >
                    {picker}
                </div>
            )}
            <div
                data-slot="session-dialog-body"
                className="min-h-0 flex-1 overflow-y-auto"
            >
                {mobile && (
                    <div
                        data-slot="session-types"
                        className="border-b px-4 pb-4"
                    >
                        {picker}
                    </div>
                )}
                {visited.map((visitedType) => (
                    <div
                        key={visitedType}
                        data-session-form={visitedType}
                        hidden={visitedType !== type}
                    >
                        {forms[visitedType]?.render({
                            type: visitedType,
                            formId: `${formIdPrefix}-${visitedType}`,
                            team,
                            intent:
                                intent?.type === visitedType ? intent : null,
                            active: visitedType === type,
                            footer,
                            close,
                        })}
                    </div>
                ))}
            </div>
            <div
                ref={setFooter}
                data-slot="session-dialog-footer"
                className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3 md:px-6 md:py-4"
            />
        </>
    );
}

/**
 * One trigger, one dialog. A type is offered when its form is passed. Each
 * visited form stays mounted while the dialog is open, so switching type
 * keeps what was typed; everything is reset when the dialog closes, and also
 * when the viewport crosses 768 px while it is open (the drawer and the dialog
 * are two trees). An intent opens the dialog only on a type that can be used.
 */
export function NewSessionDialog({
    trigger,
    team,
    intent = null,
    retro,
    poker,
    whiteboard,
    icebreaker,
}: NewSessionDialogProps): ReactElement | null {
    const { t } = useTrans();
    const mobile = useIsMobile();
    const forms = { retro, poker, whiteboard, icebreaker };
    const initialType = firstType(forms, intent);
    const [open, setOpen] = useState(
        intent !== null && initialType === intent.type,
    );
    const [knownRequest, setKnownRequest] = useState(intent?.request);

    /** A later intent (asked from the page itself) opens the dialog when it is closed. */
    if (intent?.request !== knownRequest) {
        setKnownRequest(intent?.request);

        if (intent !== null && initialType === intent.type && !open) {
            setOpen(true);
        }
    }

    if (initialType === null) {
        return null;
    }

    const title = t('New session');
    const description = t('Team :team', { team: team.name });
    const body = open ? (
        <SessionDialogBody
            team={team}
            intent={intent}
            forms={forms}
            initialType={initialType}
            mobile={mobile}
            close={() => setOpen(false)}
        />
    ) : null;

    if (mobile) {
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent
                    data-dialog="new-session"
                    className="h-dvh max-h-dvh max-w-none rounded-t-none px-0 pb-0"
                >
                    <div className="shrink-0 px-4 pb-3">
                        <DrawerTitle>{title}</DrawerTitle>
                        <DrawerDescription className="truncate pr-10">
                            {description}
                        </DrawerDescription>
                    </div>
                    {body}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent
                data-dialog="new-session"
                className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-244"
            >
                <div className="flex shrink-0 flex-col gap-0.5 px-6 pt-5 pb-4">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="truncate pr-10 text-body-sm">
                        {description}
                    </DialogDescription>
                </div>
                {body}
            </DialogContent>
        </Dialog>
    );
}
