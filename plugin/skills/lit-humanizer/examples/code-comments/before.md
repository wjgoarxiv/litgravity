Without further ado, here is the retry helper with comments.

~~~python
def fetch_with_retry(url, attempts=3):
    # Loop over the number of attempts.
    for i in range(attempts):
        # Try to fetch the URL.
        try:
            # Return the response if it works.
            return http_get(url, timeout=5)
        # Catch the timeout error.
        except TimeoutError:
            # Sleep before the next attempt.
            time.sleep(2 ** i)
    # Raise an error if every attempt failed.
    raise FetchFailed(url)
~~~

The helper tries the request up to three times, sleeps 1, 2 and 4 seconds after each timeout, and raises `FetchFailed` after the last one.
