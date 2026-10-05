import { Link } from '@inertiajs/react';
import { Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { EmptyState } from '@/components/skrum/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTeamSurvey } from '@/hooks/use-team-survey';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import { surveyApi } from '@/lib/surveys/api';
import type { SurveySettingsPatch } from '@/lib/surveys/api';
import {
    isChoiceKind,
    isSavable,
    questionBody,
    useAutosave,
} from '@/lib/surveys/builder-state';
import type {
    SurveyKind,
    SurveyQuestionPayload,
    SurveySnapshot,
} from '@/lib/surveys/types';
import { BuilderAddBar } from './builder-add-bar';
import { BuilderQuestionCard } from './builder-question-card';
import type { QuestionCardMode } from './builder-question-card';
import { BuilderQuestionList } from './builder-question-list';
import { BuilderSettingsPanel } from './builder-settings-panel';
import { BuilderStatusBadge, BuilderTopbar } from './builder-topbar';
import { SurveyPreviewDialog } from './survey-preview-dialog';

/** The `lg` breakpoint, from which the settings sit beside the questions. */
const SettingsBesideFrom = 1024;

const MaxTitleLength = 120;

type SurveyBuilderProps = {
    snapshot: SurveySnapshot;
    /** The participant view in its preview mode, given a way to close the preview; "Preview" stays disabled without it. */
    preview?: (snapshot: SurveySnapshot, close: () => void) => ReactNode;
};

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
    if (!(key in record)) {
        return record;
    }

    const { [key]: _removed, ...rest } = record;

    return rest;
}

function pick<T>(record: Record<string, T>, key: string): Record<string, T> {
    return key in record ? { [key]: record[key] } : {};
}

/** The camel-cased survey fields a settings patch changes, for the optimistic update. */
function settingsOf(
    patch: SurveySettingsPatch,
): Partial<SurveySnapshot['survey']> {
    return {
        ...(patch.one_question_at_a_time === undefined
            ? {}
            : { oneQuestionAtATime: patch.one_question_at_a_time }),
        ...(patch.show_results_after_answer === undefined
            ? {}
            : { showResultsAfterAnswer: patch.show_results_after_answer }),
        ...(patch.guest_access_enabled === undefined
            ? {}
            : { guestAccessEnabled: patch.guest_access_enabled }),
    };
}

/** The server's time of the last save, moved onto this device's clock by the gap between the two. */
function savedAtOnThisClock(
    savedAtOnServer: string | null,
    serverTimeOnServer: string,
): number | null {
    if (savedAtOnServer === null) {
        return null;
    }

    const savedAt = Date.parse(savedAtOnServer);
    const serverTime = Date.parse(serverTimeOnServer);

    if (Number.isNaN(savedAt) || Number.isNaN(serverTime)) {
        return null;
    }

    return savedAt + (Date.now() - serverTime);
}

/**
 * The builder of a team survey (mockup ScreenSurvey, frame a): the title, the
 * questions of a draft edited in place and saved by themselves, the "Add"
 * bar, and the settings beside them (in a sheet below `lg`).
 */
export function SurveyBuilder({
    snapshot: initial,
    preview,
}: SurveyBuilderProps) {
    const { t } = useTrans();
    const { snapshot, dispatch, refetch, realtime } = useTeamSurvey(initial);
    const autosave = useAutosave();
    const settingsBeside = useMinWidth(SettingsBesideFrom);
    const [selectedId, setSelectedId] = useState<string | null>(
        initial.questions[0]?.id ?? null,
    );
    const [drafts, setDrafts] = useState<Record<string, SurveyQuestionPayload>>(
        {},
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [titleDraft, setTitleDraft] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [adding, setAdding] = useState(false);
    const [toDelete, setToDelete] = useState<SurveyQuestionPayload | null>(
        null,
    );
    const [previewOpen, setPreviewOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const labelInputs = useRef(new Map<string, HTMLInputElement>());
    const pendingFocus = useRef<string | null>(null);
    const settingsInFlight = useRef(new Map<number, SurveySettingsPatch>());
    const settingsRequests = useRef(0);

    const { survey, links } = snapshot;
    const lastSavedAt = useMemo(
        () => savedAtOnThisClock(survey.savedAt, snapshot.serverTime),
        [survey.savedAt, snapshot.serverTime],
    );
    const isDraft = survey.status === 'draft';
    const isLocked = survey.hasLockedQuestions;
    const isEditable = isDraft && !isLocked;
    const questions = isDraft
        ? snapshot.questions.map((question) => drafts[question.id] ?? question)
        : snapshot.questions;
    const title = titleDraft ?? survey.title;
    const isTitleInvalid = title.trim() === '';
    const hasUnsavable =
        isTitleInvalid ||
        Object.values(drafts).some((draft) => !isSavable(draft));
    const hasFailed = Object.keys(errors).length > 0;
    const saveState =
        hasUnsavable || hasFailed
            ? ({ status: 'error', message: '' } as const)
            : autosave.state;
    const cardMode: QuestionCardMode = isLocked
        ? 'locked'
        : isDraft
          ? 'edit'
          : 'readonly';

    useEffect(() => {
        if (pendingFocus.current === null) {
            return;
        }

        const input = labelInputs.current.get(pendingFocus.current);

        if (input === undefined) {
            return;
        }

        input.focus();
        input.select();
        pendingFocus.current = null;
    });

    useEffect(() => {
        function warnBeforeLeaving(event: BeforeUnloadEvent): void {
            if (
                !autosave.hasPending() &&
                !autosave.hasFailed() &&
                !hasUnsavable &&
                !hasFailed
            ) {
                return;
            }

            event.preventDefault();
        }

        window.addEventListener('beforeunload', warnBeforeLeaving);

        return () =>
            window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [autosave, hasUnsavable, hasFailed]);

    const editQuestion = (next: SurveyQuestionPayload): void => {
        setDrafts((known) => ({ ...known, [next.id]: next }));

        if (!isSavable(next)) {
            void autosave.cancel(next.id);

            return;
        }

        autosave.schedule(next.id, async () => {
            try {
                const { question } = await surveyApi.updateQuestion(
                    survey.id,
                    next.id,
                    questionBody(next),
                );

                dispatch({ type: 'question.upsert', question });
                setErrors((known) => without(known, next.id));
                setDrafts((known) =>
                    known[next.id] === next ? without(known, next.id) : known,
                );
            } catch (error) {
                setErrors((known) => ({
                    ...known,
                    [next.id]: messageOf(error),
                }));

                throw error;
            }
        });
    };

    const editTitle = (value: string): void => {
        setTitleDraft(value);

        if (value.trim() === '') {
            void autosave.cancel('survey');

            return;
        }

        autosave.schedule('survey', async () => {
            try {
                const next = await surveyApi.update(survey.id, {
                    title: value.trim(),
                });

                dispatch({ type: 'snapshot.replace', snapshot: next });
                setErrors((known) => without(known, 'title'));
                setTitleDraft((known) => (known === value ? null : known));
            } catch (error) {
                setErrors((known) => ({ ...known, title: messageOf(error) }));

                throw error;
            }
        });
    };

    /** The settings of the requests still running, laid over an answer so that a slower one cannot undo a later switch. */
    const settingsStillSent = (): Partial<SurveySnapshot['survey']> =>
        [...settingsInFlight.current.values()].reduce(
            (known, patch) => ({ ...known, ...settingsOf(patch) }),
            {},
        );

    const changeSettings = (patch: SurveySettingsPatch): void => {
        const request = ++settingsRequests.current;

        settingsInFlight.current.set(request, patch);
        dispatch({
            type: 'snapshot.replace',
            snapshot: {
                ...snapshot,
                survey: { ...survey, ...settingsOf(patch) },
            },
        });

        const key = `settings.${Object.keys(patch).join()}`;

        autosave
            .saveNow(key, async () => {
                let next: SurveySnapshot;

                try {
                    next = await surveyApi.update(survey.id, patch);
                } finally {
                    settingsInFlight.current.delete(request);
                }

                dispatch({
                    type: 'snapshot.replace',
                    snapshot: {
                        ...next,
                        survey: { ...next.survey, ...settingsStillSent() },
                    },
                });
            })
            .catch(async (error: unknown) => {
                toast.error(messageOf(error));

                /*
                 * Once the refetch has put the server's settings back on the
                 * switch nothing is left unsaved: a failure kept under the key
                 * would block Publish until that same switch saved again.
                 * Without the server's answer the switch stays not saved.
                 */
                if (await refetch()) {
                    await autosave.cancel(key);
                }
            });
    };

    const addQuestion = async (kind: SurveyKind): Promise<void> => {
        setAdding(true);

        try {
            const { question } = await surveyApi.addQuestion(survey.id, {
                kind,
                label: t('Untitled question'),
                is_required: false,
                ...(isChoiceKind(kind)
                    ? { options: [t('Option 1'), t('Option 2')] }
                    : {}),
            });

            pendingFocus.current = question.id;
            dispatch({ type: 'question.upsert', question });
            setSelectedId(question.id);
        } catch (error) {
            toast.error(messageOf(error));
        } finally {
            setAdding(false);
        }
    };

    const removeQuestion = async (
        question: SurveyQuestionPayload,
    ): Promise<void> => {
        await autosave.cancel(question.id);

        try {
            await surveyApi.removeQuestion(survey.id, question.id);
        } catch (error) {
            toast.error(messageOf(error));

            const unsavedEdit = drafts[question.id];

            if (unsavedEdit !== undefined) {
                editQuestion(unsavedEdit);
            }

            return;
        }

        const index = questions.findIndex((known) => known.id === question.id);
        const rest = questions.filter((known) => known.id !== question.id);

        dispatch({ type: 'question.remove', questionId: question.id });
        setDrafts((known) => without(known, question.id));
        setErrors((known) => without(known, question.id));
        setSelectedId(rest[Math.min(index, rest.length - 1)]?.id ?? null);
    };

    const isPristine = (question: SurveyQuestionPayload): boolean => {
        const label = question.label.trim();
        const defaultOptions = isChoiceKind(question.kind)
            ? [t('Option 1'), t('Option 2')]
            : [];

        return (
            (label === '' || label === t('Untitled question')) &&
            question.options.map((option) => option.label).join('\n') ===
                defaultOptions.join('\n')
        );
    };

    const requestRemoval = (question: SurveyQuestionPayload): void => {
        if (isPristine(question)) {
            void removeQuestion(question);

            return;
        }

        setToDelete(question);
    };

    const duplicateQuestion = async (
        question: SurveyQuestionPayload,
    ): Promise<void> => {
        try {
            await autosave.flush();

            const { question: copy } = await surveyApi.duplicateQuestion(
                survey.id,
                question.id,
            );

            dispatch({ type: 'question.upsert', question: copy });
            setSelectedId(copy.id);
        } catch (error) {
            toast.error(messageOf(error));
        }
    };

    const reorder = async (ids: string[]): Promise<void> => {
        const previous = questions.map((question) => question.id);

        dispatch({ type: 'question.reorder', ids });

        try {
            await surveyApi.reorderQuestions(survey.id, ids);
        } catch {
            dispatch({ type: 'question.reorder', ids: previous });
            toast.error(t('The order could not be saved.'));
            void refetch();
        }
    };

    const cannotPublish = hasUnsavable || hasFailed;

    const changeStatus = async (status: 'open' | 'draft'): Promise<void> => {
        if (status === 'open' && cannotPublish) {
            toast.error(t('Some changes are not saved yet.'));

            return;
        }

        setBusy(true);

        try {
            await autosave.flush();
            await surveyApi.setStatus(survey.id, status);
            setDrafts({});
            setErrors((known) => pick(known, 'title'));
            await refetch();
        } catch (error) {
            toast.error(messageOf(error));
        } finally {
            setBusy(false);
        }
    };

    const settings = (
        <BuilderSettingsPanel
            settings={survey}
            onChange={changeSettings}
            showHeading={settingsBeside}
        />
    );

    return (
        <AppLayout
            active="sessions"
            title={survey.title}
            status={<BuilderStatusBadge status={survey.status} />}
            actions={
                <BuilderTopbar
                    status={survey.status}
                    saveState={saveState}
                    lastSavedAt={lastSavedAt}
                    questionCount={questions.length}
                    hasAnswers={snapshot.progress.responses > 0}
                    resultsHref={links.results}
                    busy={busy}
                    publishBlockedReason={
                        cannotPublish
                            ? t('Some changes are not saved yet.')
                            : undefined
                    }
                    onPreview={
                        preview === undefined
                            ? undefined
                            : () => setPreviewOpen(true)
                    }
                    onPublish={() => void changeStatus('open')}
                    onBackToDraft={() => void changeStatus('draft')}
                />
            }
        >
            <div
                data-slot="survey-builder"
                data-realtime={realtime}
                className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_--spacing(85)] lg:items-start"
            >
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="mb-2 flex min-w-0 items-start gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <h1
                                aria-label={
                                    isTitleInvalid ? survey.title : title
                                }
                                className="min-w-0 font-display text-2xl font-bold tracking-heading"
                            >
                                <input
                                    id="survey-title"
                                    aria-label={t('Title')}
                                    aria-invalid={
                                        isTitleInvalid ||
                                        errors.title !== undefined ||
                                        undefined
                                    }
                                    value={title}
                                    maxLength={MaxTitleLength}
                                    onChange={(event) =>
                                        editTitle(event.target.value)
                                    }
                                    className="-mx-1 w-full min-w-0 rounded-md bg-transparent px-1 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-invalid:ring-2 aria-invalid:ring-destructive"
                                />
                            </h1>
                            {errors.title !== undefined && (
                                <p
                                    role="alert"
                                    className="text-xs text-skrum-destructive-text"
                                >
                                    {errors.title}
                                </p>
                            )}
                            <p className="text-body-sm text-muted-foreground">
                                {questions.length === 1
                                    ? t('1 question')
                                    : t(':count questions', {
                                          count: questions.length,
                                      })}
                            </p>
                        </div>
                        {!settingsBeside && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSettingsOpen(true)}
                                className="shrink-0"
                            >
                                <Settings2 aria-hidden />
                                {t('Survey builder settings')}
                            </Button>
                        )}
                    </div>

                    {isLocked && (
                        <Alert
                            variant="info"
                            title={t(
                                "The questions of a health check come from the team's statements.",
                            )}
                            action={
                                links.healthCheck === null ? undefined : (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={links.healthCheck}>
                                            {t('Manage statements')}
                                        </Link>
                                    </Button>
                                )
                            }
                        />
                    )}
                    {!isDraft && !isLocked && (
                        <Alert
                            variant="info"
                            title={t(
                                'Questions cannot change once a survey is open.',
                            )}
                        />
                    )}

                    {questions.length === 0 && isEditable ? (
                        <EmptyState
                            module="survey"
                            title={t('No question yet')}
                            description={t(
                                'Add a first question with one of the five kinds below.',
                            )}
                            illustration={false}
                            headingLevel="h2"
                        />
                    ) : (
                        <BuilderQuestionList
                            questions={questions}
                            sortable={isEditable}
                            onReorder={(ids) => void reorder(ids)}
                            renderCard={(question, index, handle) => (
                                <BuilderQuestionCard
                                    question={question}
                                    number={index + 1}
                                    open={question.id === selectedId}
                                    mode={cardMode}
                                    handle={handle}
                                    error={errors[question.id]}
                                    registerLabel={(node) => {
                                        if (node === null) {
                                            labelInputs.current.delete(
                                                question.id,
                                            );

                                            return;
                                        }

                                        labelInputs.current.set(
                                            question.id,
                                            node,
                                        );
                                    }}
                                    onOpen={() => setSelectedId(question.id)}
                                    onChange={editQuestion}
                                    onDuplicate={() =>
                                        void duplicateQuestion(question)
                                    }
                                    onDelete={() => requestRemoval(question)}
                                />
                            )}
                        />
                    )}

                    {isEditable && (
                        <BuilderAddBar
                            questionCount={questions.length}
                            busy={adding}
                            onAdd={(kind) => void addQuestion(kind)}
                        />
                    )}

                    <Alert
                        variant="info"
                        className="mt-2"
                        title={
                            survey.resultsThreshold > 0
                                ? t(
                                      'A result is shown from :count answers, and free answers are sorted before they are shown.',
                                      { count: survey.resultsThreshold },
                                  )
                                : t(
                                      'Free answers are sorted before they are shown.',
                                  )
                        }
                    />
                </div>

                {settingsBeside ? (
                    <aside
                        aria-label={t('Survey settings')}
                        className="min-w-0 border-l bg-card p-5 lg:-my-6 lg:-mr-10 lg:min-h-[calc(100svh-3.5rem)] lg:self-stretch"
                    >
                        <div className="lg:sticky lg:top-20">{settings}</div>
                    </aside>
                ) : (
                    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                        <SheetContent side="right">
                            <SheetHeader>
                                <SheetTitle>
                                    {t('Survey builder settings')}
                                </SheetTitle>
                            </SheetHeader>
                            <SheetBody>{settings}</SheetBody>
                        </SheetContent>
                    </Sheet>
                )}
            </div>

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setToDelete(null);
                    }
                }}
                title={t('Delete this question?')}
                description={t('“:label” leaves the survey.', {
                    label: toDelete?.label ?? '',
                })}
                confirmLabel={t('Delete')}
                tone="destructive"
                onConfirm={async () => {
                    if (toDelete === null) {
                        return;
                    }

                    await removeQuestion(toDelete);
                    setToDelete(null);
                }}
            />

            {preview !== undefined && (
                <SurveyPreviewDialog
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    title={survey.title}
                >
                    {preview({ ...snapshot, questions }, () =>
                        setPreviewOpen(false),
                    )}
                </SurveyPreviewDialog>
            )}
        </AppLayout>
    );
}
