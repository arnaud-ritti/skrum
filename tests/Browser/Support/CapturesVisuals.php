<?php

namespace Tests\Browser\Support;

use Illuminate\Support\Facades\File;

trait CapturesVisuals
{
    private const array VisualWidths = [1440 => 900, 390 => 844];

    private const array VisualLocales = ['en' => 'en-US', 'fr' => 'fr-FR'];

    private const string OverflowScript = <<<'JS_WRAP'
    () => {
        const overflows = (element, box) => {
            for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
                if (node.hasAttribute('data-overflow-ok')) {
                    return false;
                }
    
                if (node === element) {
                    continue;
                }
    
                const style = getComputedStyle(node);
    
                if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
                    return false;
                }
    
                if (style.overflowX === 'clip' || style.overflowX === 'hidden') {
                    if (style.textOverflow === 'ellipsis') {
                        return false;
                    }
    
                    const clip = node.getBoundingClientRect();
    
                    return box.right > clip.right + 1 || box.left < clip.left - 1;
                }
            }
    
            return true;
        };
        const describe = (element) => element.tagName.toLowerCase()
            + (element.id ? `#${element.id}` : '')
            + (typeof element.className === 'string' && element.className ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '');
        const width = document.documentElement.clientWidth;
        const offenders = [];
    
        for (const element of document.body.querySelectorAll('*')) {
            const box = element.getBoundingClientRect();
    
            if (box.width === 0 || box.height === 0) {
                continue;
            }
    
            if ((box.right > width + 1 || box.left < -1) && overflows(element, box)) {
                offenders.push(describe(element));
            }
        }
    
        if (document.documentElement.scrollWidth > width + 1) {
            offenders.push('document');
        }
    
        return JSON.stringify([...new Set(offenders)].slice(0, 20));
    }
    JS_WRAP;

    private const string AppearanceScript = <<<'JS_WRAP'
    () => document.fonts.ready.then(() => JSON.stringify({
        dark: document.documentElement.classList.contains('dark'),
        lang: document.documentElement.lang,
    }))
    JS_WRAP;

    /**
     * An open menu or popover is placed again after the resize, a frame or more later under load,
     * and a chart is drawn again at its new width a render later: the capture waits for them, or
     * the overflow check meets them at their old place and size.
     */
    private const string SettleScript = <<<'JS'
        () => document.fonts.ready
            .then(() => Promise.allSettled(document.getAnimations()
                .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
                .map((animation) => animation.finished)))
            .then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))
            .then(() => document.querySelector('[data-radix-popper-content-wrapper], .recharts-responsive-container, svg[data-slot$="-chart"]') === null
                ? true
                : new Promise((resolve) => setTimeout(() => resolve(true), 200)))
        JS;

    /**
     * @return array<int, string>
     */
    protected function overflowingElements(mixed $page): array
    {
        return json_decode((string) $page->script(self::OverflowScript), true, flags: JSON_THROW_ON_ERROR);
    }

    /**
     * `VISUAL_ONLY=light-1440-fr` in the environment keeps one configuration and skips the seven others.
     *
     * @param  null|callable(string, array<string, string>, int): mixed  $visit  receives the path, the visit options (colour scheme, locale, reduced motion) and the width of the capture, and returns the page
     * @param  bool  $appShell  false for a page outside the application shell (a mail): it has no theme class, its dark colours come from the colour scheme of the visit alone
     * @param  bool  $fullPage  false captures the viewport only: a full-page capture resizes the window, which closes an open select
     * @param  null|string  $configuration  one configuration (`light-1440-fr`) for a capture whose fixtures and texts are written for it alone
     */
    protected function captureVisuals(string $name, string $path, ?callable $visit = null, bool $appShell = true, bool $fullPage = true, ?string $configuration = null): void
    {
        $only = getenv('VISUAL_ONLY') ?: null;
        $captured = 0;

        foreach (['light', 'dark'] as $theme) {
            foreach (self::VisualLocales as $locale => $browserLocale) {
                foreach (self::VisualWidths as $width => $height) {
                    if ($only !== null && $only !== "{$theme}-{$width}-{$locale}") {
                        continue;
                    }

                    if ($configuration !== null && $configuration !== "{$theme}-{$width}-{$locale}") {
                        continue;
                    }

                    $captured++;

                    $options = [
                        'colorScheme' => $theme,
                        'locale' => $browserLocale,
                        'reducedMotion' => 'reduce',
                    ];

                    $page = $visit === null ? browserVisit($path, $options) : $visit($path, $options, $width);

                    $page->resize($width, $height);

                    $this->captureVisualPage($page, "{$name}-{$theme}-{$width}-{$locale}", $theme, $locale, $appShell, $fullPage);
                }
            }
        }

        if ($captured === 0) {
            $this->markTestSkipped($configuration === null
                ? "VISUAL_ONLY={$only} matches no configuration of {$name}."
                : "{$name} is captured in {$configuration} only, and VISUAL_ONLY={$only} keeps another configuration.");
        }
    }

    /**
     * For a capture that drives the configurations itself: false when `VISUAL_ONLY` keeps another one.
     */
    protected function keepsVisualConfiguration(string $theme, int $width, string $locale): bool
    {
        $only = getenv('VISUAL_ONLY') ?: null;

        return $only === null || $only === "{$theme}-{$width}-{$locale}";
    }

    /**
     * Waits for the page to settle, checks its theme, language and overflow, and keeps the picture as the baseline `$label`.
     */
    protected function captureVisualPage(mixed $page, string $label, string $theme, string $locale, bool $appShell = true, bool $fullPage = true): void
    {
        File::ensureDirectoryExists(base_path('tests/visual/__screenshots__'));

        $page->script(self::SettleScript);

        if ($appShell) {
            $this->assertVisualAppearance($page, $theme, $locale, $label);
        }

        expect($this->overflowingElements($page))->toBe([], "Horizontal overflow in {$label}");

        $page->screenshot(fullPage: $fullPage, filename: "{$label}.candidate");

        CaptureFile::replaceWhenPictureDiffers(
            base_path("tests/Browser/Screenshots/{$label}.candidate"),
            base_path("tests/visual/__screenshots__/{$label}.png"),
        );
    }

    private function assertVisualAppearance(mixed $page, string $theme, string $locale, string $label): void
    {
        $appearance = json_decode((string) $page->script(self::AppearanceScript), true, flags: JSON_THROW_ON_ERROR);

        expect($appearance['dark'])->toBe($theme === 'dark', "Wrong theme in {$label}")
            ->and($appearance['lang'])->toStartWith($locale, "Wrong language in {$label}");
    }
}
