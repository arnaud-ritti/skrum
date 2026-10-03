import { Link } from '@inertiajs/react';
import { BarChart3, Pencil, VenetianMask } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { SessionShell } from '@/components/session/session-shell';
import type { SessionConnection } from '@/components/session/session-shell';
import { SessionTitle } from '@/components/session/session-title';
import { EmptyState } from '@/components/skrum/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTeamSurvey } from '@/hooks/use-team-survey';
import { useTrans } from '@/hooks/use-trans';
import SessionLayout from '@/layouts/skrum/session-layout';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import { surveyApi } from '@/lib/surveys/api';
import { answerOf } from '@/lib/surveys/question-adapter';
import type { SurveySnapshot } from '@/lib/surveys/types';
import { SurveyAnswerFlow } from './survey-answer-flow';
import { SurveyAnswerList } from './survey-answer-list';
import { SurveyClosed } from './survey-closed';
import { SurveyThanks } from './survey-thanks';
import type { SurveyAnswerSaver } from './use-survey-answers';

function SurveyHeading({ snapshot }: { snapshot: SurveySnapshot }) {
    const { t } = useTrans();
    const { survey, me } = snapshot;
    const overline =
        me.isGuest || survey.teamName === null
            ? t('Survey')
            : `${survey.teamName} · ${t('Survey')}`;

    return (
        <SessionTitle
            overline={overline}
            badges={
                <Badge
                    variant="secondary"
                    shape="pill"
                    icon={VenetianMask}
                    className="hidden md:inline-flex"
                >
                    {t('Anonymous answers')}
                </Badge>
            }
        >
            {survey.title}
        </SessionTitle>
    );
}

/**
 * The shell of a survey page (ScreenSurvey frame b): the logo, leading to the
 * team for a member and to nothing for a guest, the title, the anonymity
 * badge, the connection state and the viewer. No rail.
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
    const { me, links } = snapshot;

    return (
        <SessionShell
            kind="survey"
            chrome="logo"
            homeHref={me.isGuest ? null : links.team}
            title={<SurveyHeading snapshot={snapshot} />}
            self={{
                name: me.name,
                avatarUrl: me.avatarUrl,
                isGuest: me.isGuest,
            }}
            actions={actions}
            realtime={realtime}
            connection={connection}
            rootProps={{ role: 'region', 'aria-label': t('Survey') }}
        >
            {children}
        </SessionShell>
    );
}

/** The survey is no longer there. No realtime root: nothing is live. */
function SurveyGone({ snapshot }: { snapshot: SurveySnapshot }) {
    const { t } = useTrans();
    const teamUrl = snapshot.me.isGuest ? null : snapshot.links.team;

    return (
        <SessionLayout
            chrome="logo"
            homeHref={teamUrl}
            title={<SessionTitle>{snapshot.survey.title}</SessionTitle>}
        >
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
        </SessionLayout>
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

function EditorActions({ snapshot }: { snapshot: SurveySnapshot }) {
    const { t } = useTrans();

    if (!snapshot.me.isEditor) {
        return null;
    }

    return (
        <Button
            asChild
            variant="outline"
            className="shrink-0 max-lg:size-9 max-lg:px-0"
        >
            <Link href={snapshot.links.results} aria-label={t('Results')}>
                <BarChart3 aria-hidden />
                <span className="truncate max-lg:sr-only">{t('Results')}</span>
            </Link>
        </Button>
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

            if (held === null || held === undefined) {
                return;
            }

            const withdrawn = await surveyApi.withdrawAnswer(
                surveyId,
                question.id,
            );

            dispatch({
                type: 'answer.set',
                questionId: question.id,
                answer: withdrawn.answer,
                progress: withdrawn.progress,
            });

            return;
        }

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
            actions={<EditorActions snapshot={snapshot} />}
        >
            {view()}
        </SurveyFrame>
    );
}
