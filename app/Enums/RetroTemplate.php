<?php

namespace App\Enums;

enum RetroTemplate: string
{
    case StartStopContinue = 'start_stop_continue';
    case MadSadGlad = 'mad_sad_glad';
    case FourLs = 'four_ls';
    case WentWellToImproveActions = 'went_well_to_improve_actions';
    case Custom = 'custom';

    /**
     * @return array<int, array{
     *     value: string,
     *     label: string
     * }>
     */
    public static function options(): array
    {
        return array_map(fn (self $template) => [
            'value' => $template->value,
            'label' => $template->label(),
        ], self::cases());
    }

    public function label(): string
    {
        return match ($this) {
            self::StartStopContinue => __('Start, Stop, Continue'),
            self::MadSadGlad => __('Mad, Sad, Glad'),
            self::FourLs => __('Liked, Learned, Lacked, Longed for'),
            self::WentWellToImproveActions => __('Went well, To improve, Action ideas'),
            self::Custom => __('Custom'),
        };
    }

    /**
     * Translation keys; pass through __() when copying them into a retro.
     *
     * @return array<int, array{
     *     title: string,
     *     color: ColumnColor
     * }>
     */
    public function columns(): array
    {
        return match ($this) {
            self::StartStopContinue => [
                ['title' => 'Retro column: Start', 'color' => ColumnColor::Green],
                ['title' => 'Retro column: Stop', 'color' => ColumnColor::Red],
                ['title' => 'Retro column: Continue', 'color' => ColumnColor::Blue],
            ],
            self::MadSadGlad => [
                ['title' => 'Retro column: Mad', 'color' => ColumnColor::Red],
                ['title' => 'Retro column: Sad', 'color' => ColumnColor::Blue],
                ['title' => 'Retro column: Glad', 'color' => ColumnColor::Green],
            ],
            self::FourLs => [
                ['title' => 'Retro column: Liked', 'color' => ColumnColor::Green],
                ['title' => 'Retro column: Learned', 'color' => ColumnColor::Blue],
                ['title' => 'Retro column: Lacked', 'color' => ColumnColor::Amber],
                ['title' => 'Retro column: Longed for', 'color' => ColumnColor::Purple],
            ],
            self::WentWellToImproveActions => [
                ['title' => 'Retro column: Went well', 'color' => ColumnColor::Green],
                ['title' => 'Retro column: To improve', 'color' => ColumnColor::Amber],
                ['title' => 'Retro column: Action ideas', 'color' => ColumnColor::Blue],
            ],
            self::Custom => [],
        };
    }
}
