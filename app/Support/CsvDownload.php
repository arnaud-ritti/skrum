<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\StreamedResponse;

class CsvDownload
{
    /**
     * UTF-8 with a byte-order mark, so that spreadsheets read accents; cells are written as
     * given (make them safe with CsvCell first).
     *
     * @param  iterable<int, array<int, string>>  $rows
     */
    public static function stream(iterable $rows, string $fileName): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                return;
            }

            fwrite($output, "\u{FEFF}");

            foreach ($rows as $row) {
                fputcsv($output, $row, ',', '"', '');
            }

            fclose($output);
        }, $fileName, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
