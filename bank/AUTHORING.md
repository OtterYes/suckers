# Writing questions for To 1520

Everything in `bank/` is original practice material written for this game. Nothing here is copied from the
College Board, a textbook, or a website: passages, notes, tables, and choices are all written fresh, and no
real quotation appears anywhere. `node tools/bank.cjs` validates every file and compiles the bank into
`index.html`; `--strict-lessons` also requires the lessons and the per-cell minimums.

## Files

- `bank/rw/<slug>/lessons.json`: the skill's lessons, in order (5, or 3 for Cross-Text Connections).
- `bank/rw/<slug>/l<N>-<batch>.json`: an array of items for lesson N, batch letter a, b, or c.
- `bank/rw/<slug>/legacy.json`: the original 134 items. Only `lesson` and `tags` may be added to them.
- `bank/math/<slug>/lessons.json`: math lessons (questions are generated, so there are no item files).
- `bank/arc/*.json`: Clue Hunter tuples.

Skill slugs and id codes (the code is the id prefix):

| Domain | Skill | slug | code | lessons |
|---|---|---|---|---|
| ii | Central Ideas and Details | central-ideas | cid | 5 |
| ii | Command of Evidence: Textual | evidence-textual | cet | 5 |
| ii | Command of Evidence: Quantitative | evidence-quantitative | ceq | 5 |
| ii | Inferences | inferences | inf | 5 |
| cs | Words in Context | words-in-context | wic | 5 |
| cs | Text Structure and Purpose | text-structure | tsp | 5 |
| cs | Cross-Text Connections | cross-text | ctc | 3 |
| eoi | Transitions | transitions | tr | 5 |
| eoi | Rhetorical Synthesis | rhetorical-synthesis | rs | 5 |
| sec | Boundaries | boundaries | bnd | 5 |
| sec | Form, Structure, and Sense | form-structure-sense | fss | 5 |
| alg | Linear equations in one variable | lin-one-var | lin1 | 3 |
| alg | Linear functions | linear-functions | lfn | 3 |
| alg | Linear equations in two variables | lin-two-var | lin2 | 3 |
| alg | Systems of two linear equations | systems | sys | 3 |
| alg | Linear inequalities | inequalities | ineq | 3 |
| adv | Nonlinear functions | nonlinear-functions | nlf | 3 |
| adv | Nonlinear equations | nonlinear-equations | nle | 3 |
| adv | Equivalent expressions | equivalent-expressions | eqx | 3 |
| psda | Ratios, rates, proportions, and units | ratios-rates | rat | 3 |
| psda | Percentages | percentages | pct | 3 |
| psda | One-variable data | one-var-data | ovd | 3 |
| psda | Two-variable data | two-var-data | tvd | 3 |
| psda | Probability | probability | prb | 3 |
| psda | Inference from sample statistics | inference-stats | ist | 3 |
| geo | Area and volume | area-volume | avol | 3 |
| geo | Lines, angles, and triangles | lines-angles | lat | 3 |
| geo | Right triangles and trigonometry | right-triangles-trig | rtt | 3 |
| geo | Circles | circles | cir | 3 |

## A lesson (`lessons.json`)

An array with one object per lesson, in the order a student should meet them (by cognitive demand, not by
difficulty; every lesson has easy, medium, and hard questions):

```json
{
  "name": "Cause and effect",
  "rule": "One sentence a student can hold in their head while answering.",
  "steps": ["Read the sentence before the blank.", "Ask: is the second sentence a result, a reason, or neither?"],
  "cues": ["a result follows a cause", "the second sentence explains the first", "a reason comes after a claim"],
  "example": {"p": "A short original passage with a ______ blank.", "q": "optional stem", "c": ["four", "answer", "choices", "here"], "a": 1, "x": "Why the answer is right, naming the cue that decides it."},
  "trap": {"c": "The most tempting wrong choice, as text.", "why": "Why it tempts and why it fails."},
  "stems": ["Which choice completes the text with the most logical transition?"],
  "words": [40, 90],
  "traps": ["reversed cause", "contrast where a result belongs", "addition where a reason belongs"],
  "lv": {"1": "what makes an easy question here", "2": "medium", "3": "hard"},
  "topics": ["science", "history", "arts", "social science", "literature", "everyday life"]
}
```

- `stems` lists the exact question wordings items in this lesson may use (see the skill list below).
- `words` is the passage word band (`p` plus `p2`) for new items; the validator fails an item outside it.
- `traps` names the distractor patterns; every item's `t` names the one it uses.
- Math lessons use the same shape; `example` holds `stem`, `c`, `a`, `x`; `stems`, `words`, `traps` are optional.

## An item

```json
{"id": "tr-l2a-03", "d": "eoi", "sk": "Transitions", "lv": 2, "lesson": 2, "tags": ["solved:3/3"],
 "p": "...passage with a ______ blank...", "c": ["for example,", "however,", "as a result,", "meanwhile,"], "a": 2,
 "x": "Why the answer is right, naming the cue.", "t": "reversed cause: the second sentence is the result, not the reason."}
```

- `id`: `<code>-l<lesson><batch>-<nn>`, e.g. `tr-l2a-03` (batch a, item 03). Ids are permanent: they are stored in
  players' saves. Never reuse or renumber one.
- `d`, `sk`: exactly as in the table. `lv`: 1 easy, 2 medium, 3 hard. `lesson`: this file's lesson.
- `p`: the passage. Plain text only. Markup the game understands: `______` (a blank; four or more underscores),
  `{{text}}` (underlined), a leading `Text 1:` / `Text 2:` label, and ` / ` for a poem's line breaks.
  No HTML, no italics, no `<`, no `-->`, no smart-quote tricks. Use ’ “ ” and — as ordinary characters.
- `q`: the question. Optional for Central Ideas, Inferences, Words in Context, Transitions, Boundaries, and
  Form/Structure/Sense (the game supplies the standard wording); required for the others. Use a stem from the
  lesson's `stems` list.
- `c`: exactly four choices, distinct, parallel in form and similar in length (the longest at most about 1.6× the
  shortest). The correct answer must not be the longest choice in most of a cell.
- `a`: index of the correct choice (0–3). It is shuffled when served, so put the answer anywhere.
- `x`: why the answer is right, in two sentences at most, naming the cue that decides it. It is shown after every
  answer, so it must teach, not just assert.
- `t`: the trap: which wrong choice tempts and why it fails, starting with the trap's name from the lesson's `traps`.
- `tags`: free strings for tooling (`solved:3/3`, `variant:harbor-1` for a deliberate pair).

Per-skill forms:

- **Central Ideas and Details** (`p`, no `q` or a stem): "Which choice best states the main idea of the text?",
  "According to the text, …?", "Based on the text, which statement is true about …?" Passage 60–130 words.
- **Command of Evidence: Textual** (`p`, `q` required): a claim or hypothesis in the passage, then "Which
  finding, if true, would most directly support …?" / "…weaken …?" / "Which quotation from [an original work]
  most effectively illustrates the claim?" (the quotation choices are written by you, from an invented work).
- **Command of Evidence: Quantitative** (`p`, `q` required, `tb` for most items): a claim plus a table
  `{"cap": "...", "h": ["Year", "Percent"], "r": [["2015", "42%"], ...]}` (2–6 columns, 1–8 rows). Stems:
  "Which choice most effectively uses data from the table to complete the statement?" / "…to support the claim?"
  Every choice must be a plausible-sounding statement; only the table settles it. Some items may give the data in
  prose instead of a table.
- **Inferences** (`p`, standard stem): the passage ends with a blank; "Which choice most logically completes the text?"
- **Words in Context** (`p`): a blank with "Which choice completes the text with the most logical and precise word
  or phrase?", or a `{{word}}` with `q` "As used in the text, what does the word “word” most nearly mean?" Choices:
  same part of speech, one to three words each.
- **Text Structure and Purpose** (`p`, `q` required): "Which choice best describes the function of the underlined
  sentence in the text as a whole?" (with `{{…}}` in `p`), "…the overall structure of the text?", "…the main purpose
  of the text?"
- **Cross-Text Connections** (`p` starts with `Text 1:`, `p2` starts with `Text 2:`, `q` required): "Based on the
  texts, how would the author of Text 2 most likely respond to …?", "Which choice best describes how Text 2 relates to
  Text 1?" Each text 40–90 words.
- **Transitions** (`p`, standard stem): the blank is a transition; the four choices come from four different logic
  categories (addition, contrast, cause/effect, sequence, example, concession, emphasis).
- **Rhetorical Synthesis** (`n`: 3–7 notes, `goal`: "emphasize …" / "introduce … to an audience unfamiliar with …"):
  no `p`, no `q`. Every choice must use only the notes; one choice meets the goal.
- **Boundaries** and **Form, Structure, and Sense** (`p`, standard stem): the four choices are identical except for
  the convention under test (punctuation for Boundaries; agreement, tense, pronouns, modifiers, parallelism for FSS).

Rules of originality and fairness: invent people, places, studies, and works, or use general knowledge stated in
your own words; no living private person; no real quotations; nothing a student would need outside knowledge to
answer; exactly one defensible answer; no "NOT" or "EXCEPT" stems; no answer that is right for a reason the
passage never gives.

## Clue Hunter tuples (`bank/arc/*.json`)

```json
{"s": "The reviews were so ______ that the restaurant closed within a month.", "clue": [7, 10], "a": "scathing",
 "w": ["glowing", "lengthy", "recent"], "why": "closed within a month: the reviews were harsh"}
```

`clue` is the token range (0-based, inclusive, splitting on spaces) of the words that decide the blank.
