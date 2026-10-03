import TeamSurveyAnswersController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyAnswersController';
import TeamSurveyComparisonsController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyComparisonsController';
import TeamSurveyGuestTokensController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyGuestTokensController';
import TeamSurveyQuestionDuplicatesController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyQuestionDuplicatesController';
import TeamSurveyQuestionOrdersController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyQuestionOrdersController';
import TeamSurveyQuestionsController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyQuestionsController';
import TeamSurveysController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveysController';
import TeamSurveySnapshotsController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveySnapshotsController';
import TeamSurveyStatusesController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyStatusesController';
import TeamSurveySubmissionsController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveySubmissionsController';
import { retroRequest } from '@/lib/retro/api';
import type { AnswerBody } from './question-adapter';
import type {
    SurveyAnswer,
    SurveyComparison,
    SurveyKind,
    SurveyProgress,
    SurveyQuestionPayload,
    SurveySnapshot,
    SurveyStatus,
} from './types';

/** The body of `surveys.update`: only the settings that change are sent. */
export type SurveySettingsPatch = Partial<{
    title: string;
    description: string | null;
    guest_access_enabled: boolean;
    one_question_at_a_time: boolean;
    show_results_after_answer: boolean;
}>;

/** The body of `surveys.questions.store` and `surveys.questions.update`. */
export type SurveyQuestionBody = {
    kind: SurveyKind;
    label: string;
    description?: string | null;
    is_required?: boolean;
    allows_comment?: boolean;
    scale_min_label?: string | null;
    scale_max_label?: string | null;
    options?: string[];
};

export type SurveyQuestionResponse = { question: SurveyQuestionPayload };

export type SurveyAnswerResponse = {
    answer: SurveyAnswer | null;
    progress: SurveyProgress;
};

export const surveyApi = {
    snapshot(id: string): Promise<SurveySnapshot> {
        return retroRequest<SurveySnapshot>(
            TeamSurveySnapshotsController.show(id),
        );
    },

    update(id: string, patch: SurveySettingsPatch): Promise<SurveySnapshot> {
        return retroRequest<SurveySnapshot>(
            TeamSurveysController.update(id),
            patch,
        );
    },

    addQuestion(
        id: string,
        body: SurveyQuestionBody,
    ): Promise<SurveyQuestionResponse> {
        return retroRequest<SurveyQuestionResponse>(
            TeamSurveyQuestionsController.store(id),
            body,
        );
    },

    updateQuestion(
        id: string,
        questionId: string,
        body: SurveyQuestionBody,
    ): Promise<SurveyQuestionResponse> {
        return retroRequest<SurveyQuestionResponse>(
            TeamSurveyQuestionsController.update({
                teamSurvey: id,
                question: questionId,
            }),
            body,
        );
    },

    removeQuestion(id: string, questionId: string): Promise<null> {
        return retroRequest(
            TeamSurveyQuestionsController.destroy({
                teamSurvey: id,
                question: questionId,
            }),
        );
    },

    reorderQuestions(id: string, ids: string[]): Promise<null> {
        return retroRequest(TeamSurveyQuestionOrdersController.update(id), {
            ids,
        });
    },

    duplicateQuestion(
        id: string,
        questionId: string,
    ): Promise<SurveyQuestionResponse> {
        return retroRequest<SurveyQuestionResponse>(
            TeamSurveyQuestionDuplicatesController.store({
                teamSurvey: id,
                question: questionId,
            }),
        );
    },

    setStatus(id: string, status: SurveyStatus): Promise<null> {
        return retroRequest(TeamSurveyStatusesController.update(id), {
            status,
        });
    },

    saveAnswer(
        id: string,
        questionId: string,
        body: AnswerBody,
    ): Promise<SurveyAnswerResponse> {
        return retroRequest<SurveyAnswerResponse>(
            TeamSurveyAnswersController.update({
                teamSurvey: id,
                question: questionId,
            }),
            body,
        );
    },

    withdrawAnswer(
        id: string,
        questionId: string,
    ): Promise<SurveyAnswerResponse> {
        return retroRequest<SurveyAnswerResponse>(
            TeamSurveyAnswersController.destroy({
                teamSurvey: id,
                question: questionId,
            }),
        );
    },

    submit(id: string): Promise<SurveySnapshot> {
        return retroRequest<SurveySnapshot>(
            TeamSurveySubmissionsController.store(id),
        );
    },

    reopenResponse(id: string): Promise<SurveySnapshot> {
        return retroRequest<SurveySnapshot>(
            TeamSurveySubmissionsController.destroy(id),
        );
    },

    comparison(
        id: string,
        withId?: string,
    ): Promise<{ comparison: SurveyComparison | null }> {
        return retroRequest<{ comparison: SurveyComparison | null }>(
            TeamSurveyComparisonsController.show(
                id,
                withId === undefined ? undefined : { query: { with: withId } },
            ),
        );
    },

    newGuestLink(id: string): Promise<{ guestUrl: string }> {
        return retroRequest<{ guestUrl: string }>(
            TeamSurveyGuestTokensController.store(id),
        );
    },

    destroy(id: string): Promise<null> {
        return retroRequest(TeamSurveysController.destroy(id));
    },
};
