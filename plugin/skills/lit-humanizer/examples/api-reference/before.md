## GET /v2/branches

Great question! This endpoint returns the list of library branches.

**Evidence:** behaviour checked against the staging server on 3 October.

Parameters:

- `city` (string, optional): filters branches by city name.
- `open_now` (boolean, optional, default `false`): returns only branches that are open at the time of the request [unverified].

The response is a JSON array. Each item contains `id`, `name`, `city` and `hours`. The endpoint returns at most 50 items per page; use the `page` parameter to request more. Requests without an API key are rejected with status 401.

Let me know if you'd like examples in other languages.
