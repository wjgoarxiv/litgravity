Update stuff

This commit thoughtfully fixes the playlist issue where reloading a playlist would reset the custom order back to date added. The loader now reads the saved order before sorting, which ensures a seamless experience. Also added a test that reloads a 500-track playlist and checks the order, plus a note in the FAQ.

Generated with an AI assistant
