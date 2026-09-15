# `.c2x/`

`briefs/<harness-id>.md` is written by chat-to-x when a PLAN lands
(`c2x init`, `c2x plan`, or the dashboard). Each harness reads **only**
its own file. Do not commit briefs.

Repo walks also skip `.c2x/` (default ignore) so drops never re-enter the
packer. Extra ignores live in a root `.c2xignore` (comments with `#`;
demo workspace does not read that file).

`c2x drive` writes prompts to `outbox/` and watches `inbox/*.md` for a `[C2X]`
block. Do not commit inbox or outbox.

See `skill/SKILL.md` and spec §20.3.
