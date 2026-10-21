## Summary

Exports now write dates in ISO 8601 (2026-03-14) instead of the local format (14/03/2026). Spreadsheets in other regions were reading the local format as text.

## Changes

- The CSV writer formats dates as ISO 8601.
- A new test exports 1,000 rows and checks every date column.
- The README describes the new format.

## Risk

Saved reports that parse the old date format will need updating. Two internal dashboards read the export directly; their owners have been told.

## Testing

All 214 unit tests pass. The export from the desktop app still needs a manual check.
