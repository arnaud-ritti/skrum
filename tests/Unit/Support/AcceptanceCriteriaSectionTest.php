<?php

use App\Support\Poker\AcceptanceCriteriaSection;

it('splits a section under an ATX heading, up to the next heading of the same level', function () {
    $split = AcceptanceCriteriaSection::split("Export invoices.\n\n## Acceptance criteria\n\n- UTF-8\n- semicolon\n\n### Edge case\n\n- empty file\n\n## Notes\n\nSee ATLAS-12.");

    expect($split['criteria'])->toBe("- UTF-8\n- semicolon\n\n### Edge case\n\n- empty file")
        ->and($split['description'])->toBe("Export invoices.\n\n## Notes\n\nSee ATLAS-12.");
});

it('reads every heading markup of rule AC-1, in any case', function (string $heading) {
    $split = AcceptanceCriteriaSection::split("Intro\n{$heading}\n- one");

    expect($split['criteria'])->toBe('- one')
        ->and($split['description'])->toBe('Intro');
})->with([
    'atx' => ['# ACCEPTANCE CRITERIA'],
    'atx closed' => ['### Acceptance criteria ###'],
    'atx colon' => ['## Acceptance Criteria:'],
    'bold' => ['**Acceptance criteria**'],
    'bold colon inside' => ['**Acceptance criteria:**'],
    'bold colon outside' => ['__Acceptance criteria__:'],
    'plain colon' => ['acceptance criteria:'],
]);

it('ends a bold or colon section at the next heading or bold line', function () {
    $split = AcceptanceCriteriaSection::split("**Acceptance criteria**\n- one\n**Out of scope**\n- two");

    expect($split['criteria'])->toBe('- one')
        ->and($split['description'])->toBe("**Out of scope**\n- two");
});

it('ends a colon section at the next ATX heading of any level', function () {
    $split = AcceptanceCriteriaSection::split("Acceptance criteria:\n- one\n###### Notes\nx");

    expect($split['criteria'])->toBe('- one')
        ->and($split['description'])->toBe("###### Notes\nx");
});

it('runs a section to the end of the description when nothing ends it', function () {
    $split = AcceptanceCriteriaSection::split("Intro\n\n# Acceptance criteria\n\n- one\n\n## Detail\n\n- two");

    expect($split['criteria'])->toBe("- one\n\n## Detail\n\n- two")
        ->and($split['description'])->toBe('Intro');
});

it('splits nothing outside the rules', function (string $markdown) {
    expect(AcceptanceCriteriaSection::split($markdown))->toBe(['description' => $markdown, 'criteria' => null]);
})->with([
    'in a code block' => ["```\n## Acceptance criteria\n- one\n```"],
    'empty section' => ["Intro\n## Acceptance criteria\n\n## Notes\nx"],
    'other wording' => ["## Definition of done\n- one"],
    'translated' => ["## Critères d'acceptation\n- un"],
    'setext' => ["Acceptance criteria\n---\n- one"],
    'inside a sentence' => ['The acceptance criteria: see below.'],
    'list item' => ["- Acceptance criteria:\n- one"],
    'quote' => ["> Acceptance criteria:\n- one"],
]);

it('does not end the section at a heading inside a code block', function () {
    $split = AcceptanceCriteriaSection::split("## Acceptance criteria\n- one\n~~~\n## Notes\n~~~\n- two");

    expect($split['criteria'])->toBe("- one\n~~~\n## Notes\n~~~\n- two")
        ->and($split['description'])->toBeNull();
});

it('keeps a second heading in the body of the first', function () {
    expect(AcceptanceCriteriaSection::split("## Acceptance criteria\n- one\n\n## Acceptance criteria\n- two")['criteria'])
        ->toBe("- one\n\n## Acceptance criteria\n- two");
});

it('gives no description when the section is all there is', function () {
    expect(AcceptanceCriteriaSection::split("## Acceptance criteria\n- one"))->toBe(['description' => null, 'criteria' => '- one'])
        ->and(AcceptanceCriteriaSection::split(null))->toBe(['description' => null, 'criteria' => null])
        ->and(AcceptanceCriteriaSection::split("  \n"))->toBe(['description' => null, 'criteria' => null]);
});
