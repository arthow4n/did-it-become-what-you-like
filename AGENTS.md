# Agent Instructions

## Communication

- The repo owner commonly prompts coding agents using voice dictation. Expect
  transcription errors, incorrect words, missing punctuation, repetitions, and
  incomplete phrasing.
- Infer the likely intention from context instead of treating obvious
  dictation errors as literal requirements.
- When wording is materially ambiguous, briefly recap what you understood and
  identify the uncertain part before proceeding. Ask for clarification only
  when different interpretations would meaningfully change the result.
- Keep questions and decision prompts in small, prioritized batches that are
  easy to read and answer in a terminal.
- When gathering requirements, normally ask no more than five numbered
  questions in one batch. Use fewer when the topic benefits from a tighter
  exchange.
- Give each question a concise explanation, a short concrete example when it
  improves understanding, and a clearly labeled recommendation. Make it easy
  for the owner to answer by number or accept all recommendations at once.

## Git Workflow

- Automatically commit and push completed repository changes unless the repo
  owner says otherwise.
- Keep commits focused and use commit messages that describe the completed
  change.
- Never force-push or overwrite unrelated work to satisfy the automatic-push
  preference. Integrate concurrent remote changes safely.
