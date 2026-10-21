~~~python
def fetch_with_retry(url, attempts=3):
    for i in range(attempts):
        try:
            return http_get(url, timeout=5)
        except TimeoutError:
            time.sleep(2 ** i)
    raise FetchFailed(url)
~~~

The helper tries the request up to three times, sleeps 1, 2 and 4 seconds after each timeout, and raises `FetchFailed` after the last one.
