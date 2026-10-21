fix: keep the custom order when a playlist is reloaded

Reloading a playlist reset its custom order to date added. The loader
now reads the saved order before it sorts.

Adds a test that reloads a 500-track playlist and checks the order,
and a note in the FAQ.
