<?php

namespace App\Support;

class CsvCell
{
    private const string FormulaLeads = "=+-@\t\r";

    /**
     * A leading =, +, -, @, tab or carriage return makes a spreadsheet run the cell as a
     * formula; an apostrophe makes it text.
     */
    public static function safe(string $cell): string
    {
        if ($cell === '' || ! str_contains(self::FormulaLeads, $cell[0])) {
            return $cell;
        }

        return "'".$cell;
    }
}
