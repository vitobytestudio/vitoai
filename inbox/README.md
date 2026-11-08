# inbox — raw footage waiting to be cut

Drop files here from the GitHub web UI: <https://github.com/vitobytestudio/vitoai/upload/arena/c36750ba-vitoai/inbox/>

Rules that keep this folder from becoming a landfill:

- **25 MB is the web-upload ceiling.** Anything bigger comes through the chat instead; nothing is
  lost by that route and no blob enters git.
- Everything in this directory is ignored by `.gitignore` (`inbox/`), so `git status` stays clean
  while a file is being worked on. Only this README is tracked.
- A file uploaded via the web UI does land in the branch history. It is deleted from the branch as
  soon as the cut is done, and the PR is squashed, so raw media never reaches `main`.
- The sandbox cannot reach `objects.githubusercontent.com` (release assets),
  `media.githubusercontent.com` (issue attachments) or `raw.githubusercontent.com` — measured, not
  guessed. Git itself over `github.com` works, which is exactly why the file must arrive as a commit
  on a branch and nothing else. It is taken out of the tree with
  `git show FETCH_HEAD:inbox/<file> > inbox/<file>`, never with `git pull`.
