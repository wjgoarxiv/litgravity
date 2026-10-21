## Summary

This exciting PR thoughtfully refactors the export flow. I've carefully updated the CSV writer so that dates are written in ISO 8601 (2026-03-14) instead of the local format (14/03/2026). Spreadsheets in other regions were reading the local format as text.

## Changes

- The CSV writer formats dates as ISO 8601.
- A new test exports 1,000 rows and checks every date column.
- The README explains the new format.

## Testing

All 214 unit tests pass. The export from the desktop app still needs a manual check.

## Risk

Moreover, it is crucial to note that any saved reports that parse the old date format will need to be updated. Two internal dashboards are known to read the export directly; their owners have been notified.

Let's dive in to the review!
