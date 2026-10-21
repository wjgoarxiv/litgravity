## GET /v2/branches

Returns the list of library branches. The behaviour described here was checked against the staging server on 3 October; the `open_now` filter was left out of that check.

Parameters:

- `city` (string, optional): filters branches by city name.
- `open_now` (boolean, optional, default `false`): returns only branches that are open at the time of the request.

The response is a JSON array. Each item contains `id`, `name`, `city` and `hours`. A page holds at most 50 items; request the next page with the `page` parameter. Requests without an API key fail with status 401.
