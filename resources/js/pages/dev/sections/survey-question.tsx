import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { SurveyQuestion } from '@/components/skrum/survey-question';
import type {
    SurveyQuestionBucket,
    SurveyQuestionValue,
} from '@/components/skrum/survey-question';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex max-w-xl min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function buckets(counts: number[], first: number): SurveyQuestionBucket[] {
    return counts.map((count, i) => ({
        key: String(first + i),
        label: String(first + i),
        count,
    }));
}

function WithComment() {
    const { t } = useTrans();
    const [value, setValue] = useState<SurveyQuestionValue>(4);
    const [comment, setComment] = useState('');

    return (
        <SurveyQuestion
            id="comment"
            kind="nps"
            label={t('Would you recommend this team?')}
            mode="answer"
            value={value}
            onChange={setValue}
            comment={comment}
            onCommentChange={setComment}
        />
    );
}

function Bare() {
    const { t } = useTrans();
    const [value, setValue] = useState<SurveyQuestionValue>(null);

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
            <h3 id="bare-label" className="font-display text-xl font-semibold">
                {t('How was the sprint?')}
            </h3>
            <SurveyQuestion
                id="bare"
                kind="scale5"
                label={t('How was the sprint?')}
                mode="answer"
                chrome="none"
                labelledBy="bare-label"
                scaleLabels={[t('Strongly disagree'), t('Strongly agree')]}
                value={value}
                onChange={setValue}
            />
        </div>
    );
}

function Live() {
    const { t } = useTrans();
    const [value, setValue] = useState<SurveyQuestionValue>(null);

    return (
        <SurveyQuestion
            id="live"
            kind="scale5"
            index={1}
            count={3}
            label={t('I feel safe to speak up in this team.')}
            mode="answer"
            scaleLabels={[t('Strongly disagree'), t('Strongly agree')]}
            anonymous
            value={value}
            onChange={setValue}
        />
    );
}

export default function SurveyQuestionSection() {
    const { t } = useTrans();
    const options = [
        { id: 'a', label: t('Sprint planning'), count: 7 },
        { id: 'b', label: t('Daily stand-up'), count: 3 },
        { id: 'c', label: t('Retrospective'), count: 5 },
    ];
    const longName = t(
        'A very long option label that keeps going to check wrapping of the text inside a narrow card',
    );
    const text280 = 'x'.repeat(280);
    const manyAnswers = Array.from({ length: 200 }, (_, i) => ({
        id: `t${i}`,
        text: `${t('Answer')} ${i + 1}`,
        authorName: i % 3 === 0 ? 'Ada Lovelace' : null,
        isMine: i === 1,
    }));

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Scale 1-5, live (keys 1 to 5, anonymous)')}>
                <Live />
            </Example>
            <Example label={t('NPS 0-10, with an optional comment')}>
                <WithComment />
            </Example>
            <Example
                label={t('Scale 1-5, bare control under a heading of the page')}
            >
                <Bare />
            </Example>
            <Example label={t('Scale 1-5, unanswered')}>
                <SurveyQuestion
                    id="s"
                    kind="scale5"
                    label={t('How was the sprint?')}
                    mode="answer"
                />
            </Example>
            <Example label={t('NPS 0-10, answered')}>
                <SurveyQuestion
                    id="n"
                    kind="nps"
                    label={t('Would you recommend this team?')}
                    mode="answer"
                    value={9}
                    scaleLabels={[t('Not at all'), t('Absolutely')]}
                />
            </Example>
            <Example label={t('Single choice, selected, required')}>
                <SurveyQuestion
                    id="sc"
                    kind="single"
                    label={t('Which ritual helps most?')}
                    mode="answer"
                    options={options}
                    value="b"
                    required
                />
            </Example>
            <Example
                label={t('Single choice, answered: counts shown, can change')}
            >
                <SurveyQuestion
                    id="sca"
                    kind="single"
                    label={t('Which ritual helps most?')}
                    mode="answer"
                    options={options}
                    value="b"
                    hasAnswered
                    onWithdraw={() => undefined}
                    results={{ responses: 15 }}
                />
            </Example>
            <Example label={t('Single choice, required error')}>
                <SurveyQuestion
                    id="sce"
                    kind="single"
                    label={t('Which ritual helps most?')}
                    mode="answer"
                    options={options}
                    required
                    invalid
                />
            </Example>
            <Example label={t('Single choice, long labels, 60-character name')}>
                <SurveyQuestion
                    id="scl"
                    kind="single"
                    label={longName}
                    mode="answer"
                    options={[
                        { id: 'a', label: longName },
                        { id: 'b', label: 'x'.repeat(60) },
                    ]}
                />
            </Example>
            <Example label={t('Multiple choice, limit reached (2 max)')}>
                <SurveyQuestion
                    id="m"
                    kind="multiple"
                    label={t('Pick the rituals to keep')}
                    mode="answer"
                    options={options}
                    maxChoices={2}
                    value={['a', 'b']}
                    onSubmit={() => {}}
                />
            </Example>
            <Example label={t('Text, typing with counter (280 characters)')}>
                <SurveyQuestion
                    id="t"
                    kind="text"
                    label={t('Anything else?')}
                    mode="answer"
                    value={text280}
                    maxLength={280}
                    onSubmit={() => {}}
                />
            </Example>
            <Example label={t('Closed, answered, with description and slots')}>
                <SurveyQuestion
                    id="c"
                    kind="single"
                    label={t('Which ritual helps most?')}
                    description={t('Closed by the facilitator.')}
                    mode="answer"
                    options={options}
                    value="a"
                    closed
                    hasAnswered
                    onWithdraw={() => {}}
                    actions={<span className="text-xs">{t('Menu')}</span>}
                    footer={
                        <p className="text-xs text-muted-foreground">
                            {t('Discussion slot')}
                        </p>
                    }
                />
            </Example>
            <Example label={t('Results, scale 1-5 with mean')}>
                <SurveyQuestion
                    id="r1"
                    kind="scale5"
                    label={t('How was the sprint?')}
                    mode="results"
                    value={4}
                    results={{
                        responses: 12,
                        mean: 3.8,
                        buckets: buckets([0, 1, 3, 6, 2], 1),
                    }}
                />
            </Example>
            <Example
                label={t('Results, scale 1-5 as a histogram with its ends')}
            >
                <SurveyQuestion
                    id="r9"
                    kind="scale5"
                    label={t('How was the sprint?')}
                    mode="results"
                    scaleChart="histogram"
                    scaleLabels={[t('Unbearable'), t('Very comfortable')]}
                    results={{
                        responses: 9,
                        mean: 3.8,
                        mode: 4,
                        buckets: buckets([0, 1, 2, 4, 2], 1),
                    }}
                />
            </Example>
            <Example label={t('Results, NPS')}>
                <SurveyQuestion
                    id="r2"
                    kind="nps"
                    label={t('Would you recommend this team?')}
                    mode="results"
                    results={{
                        responses: 20,
                        nps: 25,
                        buckets: buckets([0, 0, 1, 0, 1, 1, 1, 3, 4, 5, 4], 0),
                    }}
                />
            </Example>
            <Example
                label={t(
                    'Results, scale 1-5 with mean, most frequent answer and a fall',
                )}
            >
                <SurveyQuestion
                    id="r8"
                    kind="scale5"
                    label={t('How was the sprint?')}
                    mode="results"
                    results={{
                        responses: 9,
                        mean: 3.8,
                        mode: 4,
                        delta: { value: -0.4, against: t('Sprint 41') },
                        buckets: buckets([0, 1, 2, 4, 2], 1),
                    }}
                />
            </Example>
            <Example label={t('Results, NPS with segments and a rise')}>
                <SurveyQuestion
                    id="r11"
                    kind="nps"
                    label={t('Would you recommend this team?')}
                    mode="results"
                    results={{
                        responses: 9,
                        nps: 22,
                        segments: { detractors: 2, passives: 3, promoters: 4 },
                        delta: { value: 11, against: t('Sprint 41') },
                        buckets: buckets([0, 0, 0, 0, 0, 1, 1, 2, 1, 2, 2], 0),
                    }}
                />
            </Example>
            <Example label={t('Results, NPS with no change')}>
                <SurveyQuestion
                    id="r10"
                    kind="nps"
                    label={t('Would you recommend this team?')}
                    mode="results"
                    results={{
                        responses: 9,
                        nps: 22,
                        segments: { detractors: 2, passives: 3, promoters: 4 },
                        delta: { value: 0, against: t('Sprint 41') },
                        buckets: buckets([0, 0, 0, 0, 0, 1, 1, 2, 1, 2, 2], 0),
                    }}
                />
            </Example>
            <Example label={t('Results, single choice (voters shown)')}>
                <SurveyQuestion
                    id="r3"
                    kind="single"
                    label={t('Which ritual helps most?')}
                    mode="results"
                    value="a"
                    options={options.map((o) => ({
                        ...o,
                        voters: [{ id: 'u1', name: 'Ada Lovelace' }],
                    }))}
                    results={{ responses: 15 }}
                />
            </Example>
            <Example label={t('Results, multiple choice')}>
                <SurveyQuestion
                    id="r4"
                    kind="multiple"
                    label={t('Pick the rituals to keep')}
                    mode="results"
                    options={options}
                    results={{ responses: 8 }}
                    value={['a', 'c']}
                />
            </Example>
            <Example label={t('Results, text (200 answers, keywords, quotes)')}>
                <SurveyQuestion
                    id="r5"
                    kind="text"
                    label={t('Anything else?')}
                    mode="results"
                    results={{
                        responses: 200,
                        textAnswers: manyAnswers,
                        keywords: [
                            { word: 'meetings', weight: 3 },
                            { word: 'focus', weight: 2 },
                            { word: 'tooling', weight: 1 },
                        ],
                        quotes: [t('Fewer meetings, more focus time.')],
                    }}
                />
            </Example>
            <Example label={t('Results hidden by the server')}>
                <SurveyQuestion
                    id="r6"
                    kind="single"
                    label={t('Which ritual helps most?')}
                    mode="results"
                    options={options}
                    results={{ responses: 2, hidden: true }}
                />
            </Example>
            <Example label={t('Results, 0 responses')}>
                <SurveyQuestion
                    id="r7"
                    kind="single"
                    label={t('Which ritual helps most?')}
                    mode="results"
                    options={options.map((o) => ({ ...o, count: 0 }))}
                    results={{ responses: 0 }}
                />
            </Example>
        </div>
    );
}
