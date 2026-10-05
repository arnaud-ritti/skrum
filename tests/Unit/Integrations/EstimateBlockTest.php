<?php

use App\Support\Integrations\GitHub\EstimateBlock;

it('appends the block once after the trimmed body', function () {
    expect(EstimateBlock::apply("Fix the login.\n\n  ", '5'))->toBe("Fix the login.\n\n".renderedEstimateBlock('5'))
        ->and(EstimateBlock::apply(null, '5'))->toBe(renderedEstimateBlock('5'))
        ->and(EstimateBlock::apply('', '½'))->toBe(renderedEstimateBlock('½'));
});

it('updates the block in place and keeps every other byte', function () {
    $body = "Intro\r\n\r\n".renderedEstimateBlock('3')."\r\n\r\n- [ ] keep *this*\r\ntrailing  ";

    $updated = EstimateBlock::apply($body, '8');

    expect($updated)->toBe(str_replace('**Estimate:** 3', '**Estimate:** 8', $body))
        ->and(EstimateBlock::strip($updated))->toBe(EstimateBlock::strip($body))
        ->and(EstimateBlock::apply($updated, '8'))->toBe($updated);
});

it('collapses copies into the first block', function () {
    $body = "A\n\n".renderedEstimateBlock('3')."\n\nB\n\n".renderedEstimateBlock('5')."\n\nC";

    $updated = EstimateBlock::apply($body, '8');

    expect($updated)->toBe("A\n\n".renderedEstimateBlock('8')."\n\nB\n\nC")
        ->and(EstimateBlock::count($updated))->toBe(1);
});

it('removes the block and its separator when the estimate is cleared', function () {
    expect(EstimateBlock::apply("Fix it.\n\n".renderedEstimateBlock('5'), null))->toBe('Fix it.')
        ->and(EstimateBlock::apply(renderedEstimateBlock('5')."\n\nAfter", null))->toBe('After')
        ->and(EstimateBlock::apply("Fix it.\n", null))->toBe("Fix it.\n");
});

it('reads the value with whitespace around the markers', function () {
    $body = "Body\n\n  <!-- skrum:estimate -->  \n**Estimate:**  XL \n\t<!-- /skrum:estimate -->";

    expect(EstimateBlock::value($body))->toBe('XL')
        ->and(EstimateBlock::count($body))->toBe(1)
        ->and(EstimateBlock::strip($body))->toBe('Body');
});

it('escapes Markdown in labels and reads them back', function () {
    expect(EstimateBlock::render('*_[x]`'))->toBe("<!-- skrum:estimate -->\n**Estimate:** \\*\\_\\[x\\]\\`\n<!-- /skrum:estimate -->")
        ->and(EstimateBlock::value(EstimateBlock::render('*_[x]`')))->toBe('*_[x]`')
        ->and(EstimateBlock::value(EstimateBlock::render('<3|#')))->toBe('<3|#');
});

it('never writes ? or ☕', function (string $card) {
    expect(fn () => EstimateBlock::apply('Body', $card))->toThrow(InvalidArgumentException::class);
})->with(['?', '☕']);

it('ignores markers that are not a block', function (string $body) {
    expect(EstimateBlock::value($body))->toBeNull()
        ->and(EstimateBlock::count($body))->toBe(0)
        ->and(EstimateBlock::strip($body))->toBe($body);
})->with([
    'other case' => ["<!-- SKRUM:estimate -->\n**Estimate:** 3\n<!-- /SKRUM:estimate -->"],
    'unclosed' => ["<!-- skrum:estimate -->\n**Estimate:** 3"],
    'inline marker' => ["see <!-- skrum:estimate --> here\n**Estimate:** 3\n<!-- /skrum:estimate -->"],
]);

it('appends a block after an unclosed one without touching it', function () {
    $body = "<!-- skrum:estimate -->\n**Estimate:** 3";

    $updated = EstimateBlock::apply($body, '5');

    expect($updated)->toBe("{$body}\n\n".renderedEstimateBlock('5'))
        ->and(EstimateBlock::count($updated))->toBe(1)
        ->and(EstimateBlock::value($updated))->toBe('5');
});

it('keeps CRLF bodies intact when appending and clearing', function () {
    $body = "Line one\r\nLine two\r\n";

    $applied = EstimateBlock::apply($body, '5');

    expect($applied)->toBe("Line one\r\nLine two\n\n".renderedEstimateBlock('5'))
        ->and(EstimateBlock::value($applied))->toBe('5')
        ->and(EstimateBlock::strip("Intro\r\n\r\n".str_replace("\n", "\r\n", renderedEstimateBlock('5'))."\r\n\r\nTail"))->toBe("Intro\r\n\r\nTail");
});

it('reads a CRLF block value without a trailing carriage return', function () {
    $body = str_replace("\n", "\r\n", renderedEstimateBlock('13'));

    expect(EstimateBlock::value($body))->toBe('13')
        ->and(EstimateBlock::count($body))->toBe(1);
});

it('treats marker strings in user text as plain text', function () {
    $body = "Docs say `<!-- skrum:estimate -->` opens it and `<!-- /skrum:estimate -->` closes it.\n\n- <!-- skrum:estimate -->\n- <!-- /skrum:estimate -->";

    $updated = EstimateBlock::apply($body, '5');

    expect(EstimateBlock::count($body))->toBe(0)
        ->and($updated)->toBe("{$body}\n\n".renderedEstimateBlock('5'))
        ->and(EstimateBlock::strip($updated))->toBe($body);
});

it('does not read the estimate from the user text around the block', function () {
    $body = "**Estimate:** 99\n\n".renderedEstimateBlock('5')."\n\n**Estimate:** 1";

    expect(EstimateBlock::value($body))->toBe('5')
        ->and(EstimateBlock::apply($body, '8'))->toBe(str_replace('**Estimate:** 5', '**Estimate:** 8', $body));
});

it('keeps a body already over the maximum length and only adds the block', function () {
    $body = str_repeat('x', EstimateBlock::MaxBodyLength + 10);

    $updated = EstimateBlock::apply($body, '5');

    expect($updated)->toBe("{$body}\n\n".renderedEstimateBlock('5'))
        ->and(EstimateBlock::apply($updated, null))->toBe($body);
});

it('preserves multibyte text byte for byte around the block', function () {
    $text = str_repeat('é', 32767).'日本語🎉';
    $body = "{$text}\n\n".renderedEstimateBlock('½')."\n\n{$text}";

    $updated = EstimateBlock::apply($body, '☃');

    expect($updated)->toBe("{$text}\n\n".renderedEstimateBlock('☃')."\n\n{$text}")
        ->and(mb_check_encoding($updated, 'UTF-8'))->toBeTrue()
        ->and(EstimateBlock::value($updated))->toBe('☃')
        ->and(EstimateBlock::strip($updated))->toBe("{$text}\n\n{$text}");
});

it('finds a legitimate block with a huge interior', function () {
    $interior = str_repeat("a line of text\n", 5000);
    $body = "Intro\n\n<!-- skrum:estimate -->\n**Estimate:** 5\n{$interior}<!-- /skrum:estimate -->\n\nTail";

    expect(strlen($interior))->toBeGreaterThan(70000)
        ->and(EstimateBlock::count($body))->toBe(1)
        ->and(EstimateBlock::value($body))->toBe('5')
        ->and(EstimateBlock::apply($body, '8'))->toBe("Intro\n\n".renderedEstimateBlock('8')."\n\nTail");
});

it('does not duplicate blocks after an unclosed marker followed by a huge body', function () {
    $huge = str_repeat("some user text\n", 5000);
    $body = "<!-- skrum:estimate -->\n{$huge}\n".renderedEstimateBlock('3');

    $updated = EstimateBlock::apply($body, '5');

    expect(EstimateBlock::count($body))->toBe(1)
        ->and(EstimateBlock::value($body))->toBe('3')
        ->and($updated)->toBe(str_replace('**Estimate:** 3', '**Estimate:** 5', $body))
        ->and(EstimateBlock::count($updated))->toBe(1);
});

it('does not duplicate blocks after an unclosed marker followed by one very long line', function () {
    $body = "<!-- skrum:estimate -->\n".str_repeat('x', 70000);

    expect(EstimateBlock::count($body))->toBe(0)
        ->and(EstimateBlock::count(EstimateBlock::apply($body, '5')))->toBe(1);
});

it('neutralises mentions and ampersands in labels and reads them back', function () {
    $rendered = EstimateBlock::render('@octocat &amp;');

    expect($rendered)->toContain("@\u{200B}octocat \\&amp;")
        ->and(EstimateBlock::value($rendered))->toBe('@octocat &amp;');
});

it('refuses labels with line breaks and padded unwritable cards', function (string $label) {
    expect(fn () => EstimateBlock::render($label))->toThrow(InvalidArgumentException::class);
})->with(["5\n<!-- /skrum:estimate -->", "5\r", ' ?', "☕\t", '  ', '']);

it('reads only the value line right after the opening marker', function () {
    $body = "<!-- skrum:estimate -->\nnote\n**Estimate:** 99\n<!-- /skrum:estimate -->";

    expect(EstimateBlock::value($body))->toBeNull()
        ->and(EstimateBlock::value("<!-- skrum:estimate -->\n**Estimate:** 5\n**Estimate:** 99\n<!-- /skrum:estimate -->"))->toBe('5');
});

it('scans a maximum-size body of short lines after an unclosed marker', function () {
    $body = "<!-- skrum:estimate -->\n".str_repeat("x\n", 32000);

    expect($body)->toHaveLength(64024)
        ->and(EstimateBlock::count($body))->toBe(0)
        ->and(EstimateBlock::value($body))->toBeNull()
        ->and(EstimateBlock::strip($body))->toBe($body)
        ->and(EstimateBlock::count(EstimateBlock::apply($body, '5')))->toBe(1);
});
