# Rules receipt: <question in one line>

Path in question: <edit target or "inventory only">
agy build: <agy --version>
Date: <UTC ISO-8601>

## Sources read
| Source | Lane | Path |
| --- | --- | --- |
| <name> | workspace file / plugin rule / global rule / session context / skill catalog | <path> |

## Rules applied
- `<path>` section "<name>": "<quote>" - scope: <directory | pattern | whole workspace> - strength: hard | preference

## Rules out of scope
- `<path>` section "<name>": scope is <x>, the path in question is <y>

## Conflicts
- "<quote A>" (<source>) against "<quote B>" (<source>): settled by <user instruction | safety boundary | nearer file | asked>

## Stale guidance
- "<quote>" contradicts <observed state>

## Inferred conventions (lower confidence)
- <pattern seen in n neighboring files>

## Absence
- <no guidance file exists for X | none>

## Catalog facts (skill questions only)
- skills listed: <n>; entries shown without a description: <ids>; plugin bundle validation: <result>

## Action for the user
<one line, or none>
