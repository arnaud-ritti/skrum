<?php

it('detects a word inside a sentence, as an exact value and with accents', function () {
    expect(gamePayloadExposesWord(['text' => 'the Sprint is over'], 'sprint'))->toBeTrue()
        ->and(gamePayloadExposesWord(['word' => 'sprint'], 'SPRINT'))->toBeTrue()
        ->and(gamePayloadExposesWord(['text' => 'un élève'], 'eleve'))->toBeTrue()
        ->and(gamePayloadExposesWord(['text' => 'un eleve'], 'élève'))->toBeTrue();
});

it('ignores a word that only appears inside a longer word', function () {
    expect(gamePayloadExposesWord(['text' => 'a category'], 'cat'))->toBeFalse()
        ->and(gamePayloadExposesWord(['mask' => ['c', null, 't']], 'cat'))->toBeFalse();
});
