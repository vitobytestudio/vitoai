# inbox — raw footage waiting to be cut

Drop files here from the GitHub web UI: <https://github.com/vitobytestudio/vitoai/upload/arena/c36750ba-vitoai/inbox/>

Rules that keep this folder from becoming a landfill:

- **25 MB is the web-upload ceiling.** Anything bigger comes through the chat instead; nothing is
  lost by that route and no blob enters git.
- Everything in this directory is ignored by `.gitignore` (`inbox/`), so `git status` stays clean
  while a file is being worked on. Only this README is tracked.
- A file uploaded via the web UI does land in the branch history. It is deleted from the branch as
  soon as the cut is done, and the PR is squashed, so raw media never reaches `main`.
## A file bigger than 25 MB

`inbox/split.html` is a single self-contained page (no server, no library, nothing uploaded — it runs
entirely in the browser) that slices any file into byte-exact parts and records a SHA-256 per part.
The parts are committed to this branch, then reassembled here with `cat`, and every part is verified
against its recorded hash before a frame is cut. Slicing is byte arithmetic, so the original is never
re-encoded: no quality loss, no metadata rewrite.

Verified, not assumed: the page's exact slicing and hashing algorithm was run in Node against a
reference implementation in Python and produced the same three part hashes and the same whole-file
hash; the same split/`cat`/compare loop was run on a real 3,798,154-byte mp4 (4 parts) and `cmp`
reported no difference against the original. What was *not* verified is the page's visual layout — no
screenshot could be produced in this sandbox (a GPU-less chromium build and a blocked headless-shell
download), so the page sticks to plain flex/grid and a system font stack, where a mistake would be
cosmetic rather than functional.

- The sandbox cannot reach `objects.githubusercontent.com` (release assets),
  `media.githubusercontent.com` (issue attachments) or `raw.githubusercontent.com` — measured, not
  guessed. Git itself over `github.com` works, which is exactly why the file must arrive as a commit
  on a branch and nothing else. It is taken out of the tree with
  `git show FETCH_HEAD:inbox/<file> > inbox/<file>`, never with `git pull`.
