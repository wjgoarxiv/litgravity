# tidy-csv

Welcome to tidy-csv, a powerful, seamless and robust tool that delves into the intricate world of messy spreadsheets!

tidy-csv removes empty rows, trims spaces around values and converts the header row to snake_case. It reads files up to 2 GB.

## Installation

Without further ado, install it with:

~~~sh
pip install tidy-csv
~~~

tidy-csv needs Python 3.10 or later.

## Usage

~~~sh
tidy-csv input.csv -o output.csv
~~~

The original file is never modified. If `-o` is missing, the result is printed to standard output.
