# Import intermediate representation

The three importers emit JSON in one shared shape. It records content relationships and leaves layout to the redraw.

~~~json
{
  "schemaVersion": 1,
  "sourceFormat": "mermaid",
  "sourceDigest": "sha256:...",
  "title": "",
  "suggestedType": "flowchart",
  "nodes": [
    { "id": "n-1", "label": "Example", "kind": "process", "shape": "box", "parentId": null }
  ],
  "relationships": [
    { "from": "n-1", "to": "n-2", "label": "continues", "kind": "flow", "direction": "forward" }
  ],
  "groups": [],
  "discarded": {},
  "warnings": []
}
~~~

The extractor generates the ids, and an id never holds executable markup. Labels are inert strings. Fill only the fields the source format represents, and describe missing data in `warnings`.

The rendering step receives relationships only. Source coordinates, fills, fonts, CSS, links, script bodies, click handlers, instruction-like comments and image or embed payloads stay out of it. The agent redraws the relationships on a new grid taken from the selected type guide.

The source digest is a provenance checksum and says nothing about trust. Input size, element count, nesting depth and string length are capped before the intermediate representation is built. Malformed or unsupported input is rejected, and no remote resource is opened.
