# tidy-csv

tidy-csv removes empty rows from a CSV file, trims spaces around values and converts the header row to snake_case. It reads files up to 2 GB.

## Installation

Requires Python 3.10 or later.

~~~sh
pip install tidy-csv
~~~

## Usage

~~~sh
tidy-csv input.csv -o output.csv
~~~

The original file stays as it was. Without `-o`, the result goes to standard output.
