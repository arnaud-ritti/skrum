import { Link } from '@inertiajs/react';
import { BarChart3, Pencil, VenetianMask } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { toast } from 'sonner';
import type { SessionConnection } from '@/components/session/session-shell';
import { ConnectionState } from '@/components/skrum/connection-state';
import { EmptyState } from '@/components/skrum/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTeamSurvey } from '@/hooks/use-team-survey';
import { useTrans } from '@/hooks/use-trans';
import { KeyboardShortcutsDialog } from '@/components/workspaces/keyboard-shortcuts-dialog';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { HeaderLogo, SelfAvatar } from '@/layouts/skrum/session-layout';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import type { PresenceMember } from '@/lib/retro/types';
import { surveyApi } from '@/lib/surveys/api';
import { answerOf } from '@/lib/surveys/question-adapter';
import type { SurveyAction } from '@/lib/surveys/survey-reducer';
import type { SurveySnapshot } from '@/lib/surveys/types';
import { SurveyAnswerFlow } from './survey-answer-flow';
import { SurveyAnswerList } from './survey-answer-list';
import { SurveyClosed } from './survey-closed';
import { SurveyShare } from './survey-share';
import { SurveyThanks } from './survey-thanks';
import type { SurveyAnswerSaver } from './use-survey-answers';

/**
 * The survey's own header (ScreenSurvey frame b): the logo, leading to the team
 * for a member and to nothing for a guest; the title with the team; the
 * actions of an editor; "Anonymous answers" and the viewer. Not the chrome of
 * the session pages: no "Synced", no shortcuts button ("?" still opens them).
 */
function SurveyChrome({
    snapshot,
    actions,
    children,
}: {
    snapshot: SurveySnapshot;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const { survey, me, links } = snapshot;
    const shortcuts = useGlobalShortcuts();
    const teamName = me.isGuest ? null : survey.teamName;

    return (
        <div
            data-slot="survey-frame"
            className="flex h-svh min-h-svh w-full min-w-0 flex-col overflow-hidden bg-skrum-canvas"
        >
            <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
                <HeaderLogo
                    homeHref={me.isGuest ? null : links.team}
                    isGuest={me.isGuest}
                />
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                    <h1 className="min-w-0 truncate text-base font-semibold">
                        {survey.title}
                    </h1>
                    {teamName !== null && (
                        <span
                            data-slot="survey-team"
                            className="hidden max-w-48 shrink-0 truncate text-sm text-muted-foreground md:inline"
                        >
                            {`· ${teamName}`}
                        </span>
                    )}
                </div>
                {actions}
                <Badge
                    variant="secondary"
                    shape="pill"
                    icon={VenetianMask}
                    className="hidden shrink-0 md:inline-flex"
                >
                    {t('Anonymous answers')}
                </Badge>
                <SelfAvatar
                    self={{
                        name: me.name,
                        avatarUrl: me.avatarUrl,
                        isGuest: me.isGuest,
                    }}
                />
            </header>
            <main className="relative min-h-0 flex-1">{children}</main>
            <KeyboardShortcutsDialog
                shortcuts={shortcuts}
                palette={false}
                sidebar={false}
                preference="switch"
            />
        </div>
    );
}

/**
 * A live survey page: its own header, then the one realtime root, named
 * "Survey", with the reconnecting banner (the survey's sentence) and the
 * expired state that makes the page inert.
 */
export function SurveyFrame({
    snapshot,
    realtime,
    connection,
    actions,
    children,
}: {
    snapshot: SurveySnapshot;
    realtime: RealtimeState;
    connection: SessionConnection;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const isReconnecting = connection.reconnecting && !connection.expired;

    return (
        <SurveyChrome snapshot={snapshot} actions={actions}>
            <div
                role="region"
                aria-label={t('Survey')}
                data-slot="session-root"
                data-realtime={realtime}
                className="flex h-full min-h-0 flex-col"
            >
                {isReconnecting && (
                    <ConnectionState
                        status="reconnecting"
                        variant="banner"
                        hint={t(
                            'Your answers are saved as you give them; the counter is paused.',
                        )}
                        className="m-2"
                    />
                )}
                {connection.expired && (
                    <ConnectionState
                        status="expired"
                        variant="banner"
                        onReload={() => window.location.reload()}
                        className="m-2"
                    />
                )}
                <div
                    inert={connection.expired}
                    className="relative min-h-0 flex-1"
                >
                    {children}
                </div>
            </div>
        </SurveyChrome>
    );
}

/** The survey is no longer there. No realtime root: nothing is live. */
function SurveyGone({ snapshot }: { snapshot: SurveySnapshot }) {
    const { t } = useTrans();
    const teamUrl = snapshot.me.isGuest ? null : snapshot.links.team;

    return (
        <SurveyChrome snapshot={snapshot}>
            <div className="flex h-full items-center justify-center overflow-y-auto p-6">
                <EmptyState
                    module="survey"
                    title={t('This survey was deleted.')}
                    description={t('It is no longer available to anyone.')}
                    action={
                        teamUrl
                            ? {
                                  label: t('Back to the team'),
                                  href: teamUrl,
                                  variant: 'outline',
                              }
                            : undefined
                    }
                />
            </div>
        </SurveyChrome>
    );
}

function SurveyDraft({ editHref }: { editHref: string | null }) {
    const { t } = useTrans();

    return (
        <div className="flex h-full items-center justify-center overflow-y-auto p-6">
            <EmptyState
                module="survey"
                title={t('This survey is not open yet.')}
                description={t('It can be answered once it is published.')}
                action={
                    editHref
                        ? {
                              label: t('Edit survey'),
                              icon: Pencil,
                              href: editHref,
                          }
                        : undefined
                }
            />
        </div>
    );
}

function EditorActions({
    snapshot,
    online,
    dispatch,
}: {
    snapshot: SurveySnapshot;
    online: readonly PresenceMember[];
    dispatch: Dispatch<SurveyAction>;
}) {
    const { t } = useTrans();

    if (!snapshot.me.isEditor) {
        return null;
    }

    return (
        <>
            <Button
                asChild
                variant="outline"
                className="shrink-0 max-lg:size-9 max-lg:px-0"
            >
                <Link href={snapshot.links.results} aria-label={t('Results')}>
                    <BarChart3 aria-hidden />
                    <span className="truncate max-lg:sr-only">
                        {t('Results')}
                    </span>
                </Link>
            </Button>
            <SurveyShare
                snapshot={snapshot}
                online={online}
                dispatch={dispatch}
            />
        </>
    );
}

/** The participant page: answer, finish, thanks, closed or gone, from the live snapshot. */
export function SurveyRoom({ initial }: { initial: SurveySnapshot }) {
    const { t } = useTrans();
    const state = useTeamSurvey(initial);
    const { snapshot, dispatch } = state;
    const [restartAt, setRestartAt] = useState<number | undefined>();
    const [reopening, setReopening] = useState(false);
    const latest = useRef(snapshot);
    const savedHere = useRef(new Set<string>());

    latest.current = snapshot;

    if (state.gone) {
        return <SurveyGone snapshot={snapshot} />;
    }

    const surveyId = snapshot.survey.id;

    const onSave: SurveyAnswerSaver = async (question, value, comment) => {
        const body = answerOf(question, value, comment);

        if (body === null) {
            const held = latest.current.questions.find(
                (known) => known.id === question.id,
            )?.myAnswer;

            if (
                (held === null || held === undefined) &&
                !savedHere.current.has(question.id)
            ) {
                return;
            }

            const withdrawn = await surveyApi.withdrawAnswer(
                surveyId,
                question.id,
            );

            savedHere.current.delete(question.id);

            dispatch({
                type: 'answer.set',
                questionId: question.id,
                answer: withdrawn.answer,
                progress: withdrawn.progress,
            });

            return;
        }

        savedHere.current.add(question.id);

        const saved = await surveyApi.saveAnswer(surveyId, question.id, body);

        dispatch({
            type: 'answer.set',
            questionId: question.id,
            answer: saved.answer,
            progress: saved.progress,
        });
    };

    const onFinish = async (): Promise<void> => {
        dispatch({
            type: 'snapshot.replace',
            snapshot: await surveyApi.submit(surveyId),
        });
    };

    const changeAnswers = async (): Promise<void> => {
        if (reopening) {
            return;
        }

        setReopening(true);

        try {
            const reopened = await surveyApi.reopenResponse(surveyId);

            setRestartAt(0);
            dispatch({ type: 'snapshot.replace', snapshot: reopened });
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        } finally {
            setReopening(false);
        }
    };

    const view = (): ReactNode => {
        const { survey, me, questions } = snapshot;

        if (survey.status === 'draft') {
            return <SurveyDraft editHref={snapshot.links.edit} />;
        }

        if (survey.status === 'closed') {
            return (
                <SurveyClosed
                    closedAt={survey.closedAt}
                    resultsHref={snapshot.links.results}
                />
            );
        }

        if (me.hasSubmitted) {
            return (
                <SurveyThanks
                    snapshot={snapshot}
                    busy={reopening}
                    onChangeAnswers={() => void changeAnswers()}
                />
            );
        }

        if (survey.oneQuestionAtATime) {
            return (
                <SurveyAnswerFlow
                    questions={questions}
                    onSave={onSave}
                    onFinish={onFinish}
                    initialStep={restartAt}
                />
            );
        }

        return (
            <SurveyAnswerList
                questions={questions}
                onSave={onSave}
                onFinish={onFinish}
            />
        );
    };

    return (
        <SurveyFrame
            snapshot={snapshot}
            realtime={state.realtime}
            connection={state.connection}
            actions={
                <EditorActions
                    snapshot={snapshot}
                    online={state.online}
                    dispatch={dispatch}
                />
            }
        >
            {view()}
        </SurveyFrame>
    );
}
