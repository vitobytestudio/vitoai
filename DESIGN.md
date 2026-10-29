# DESIGN — when to use what

> 3D is not a style. It is a tool with a narrow job: **an idea that is genuinely
> spatial**. Everything else is better served by type, grid, data and cuts.
>
> A film where most beats are 3D does not read as premium — it reads as a tech
> demo. Restraint is the difference.

## The rule

| The beat is about… | Use | Never |
|---|---|---|
| a network, a globe, a swarm, an object you **turn** | 3D | — |
| a **statement** ("Everything you need") | kinetic type, cuts, holds | 3D |
| a **list** (six services) | grid, rails, split-flap counters | 3D cards |
| a **number** | type doing the shouting | 3D |
| **momentum** (a transition) | whip, match-cut, wipe | 3D |
| **proof** (uptime, latency) | data layout, sparklines in 2D | 3D |

**Ceiling: one third of the beats.** Past that the 3D stops being an event.

## The five questions before adding any 3D

1. If this were flat, would the idea still land? → **then make it flat.**
2. Does the camera actually move, or is it a static render rotated? → static is a still.
3. Is the object recognisable at a glance? → if not, it is decoration.
4. Does it earn its render cost? (0.069s/frame per layer) → if it is background, no.
5. Would a studio put this in an ad, or in a demo reel? → ads are quieter.

## What actually reads as premium

These carry more weight than any 3D, and cost almost nothing:

- **Type, sized and weighted with conviction.** One huge line beats four medium ones.
- **Negative space.** A frame that is 70% black is a decision, not a mistake.
- **A single accent colour** doing the pointing.
- **Hard cuts on the beat.** No crossfade ever.
- **One moving element per frame.** Everything moving = nothing moving.
- **Micro-detail that implies craft**: 1px hairlines, a real grid, correct optical
  alignment, numerals that don't jump as they count.

## Applied to NEXUS SIGNAL

`python3 scripts/check_mix.py` audits the actual composition:

```
beats using a 3D subject: 5/8 (62%)   → over the ceiling
```

The honest re-cut, when asked for:

| beat | now | should be |
|---|---|---|
| B title | extruded 3D type | flat type, hard cut in, subtle scale drift |
| C wall | 3D panel wall | 2D grid of cards on a slow parallax |
| E swarm | 3D | **keep** — the idea is a swarm |
| F breach | 3D swarm | **keep** — breaking something spatial |
| G heal | 3D swarm | **keep** — the repair is spatial |
| I resolve | 3D mark | flat mark + type (the mark is a logotype, not an object) |

Result would be 3/8 = 37% → still slightly high; H is already flat, so the target
is B, C, I flat and the swarm trilogy as the only 3D.

## Anti-patterns that have already been rejected

- Grain and halation stacked "because film". At 0.09 grain the encoder fights it.
- A whip on every cut. It stops reading as speed and starts reading as a fault.
- HUD rails on every frame — decoration pretending to be information.
- 3D on a logotype. A wordmark is flat by definition; extruding it is a fad.

## The eleven pages

Every beat is drawn by one of eleven page architectures. The set is the product:
it is why two briefs never produce the same film, and why a beat that has
nothing to say can be given a page that says nothing on purpose.

| id | the page | it is for | it never does |
|---|---|---|---|
| `poster` | one place, full bleed, type in the lower third | a place that needs stating | carry two ideas |
| `editorial` | the place behind an oversized index numeral, copy in a column | the argument of the film | use the numeral as decoration |
| `silent` | no copy at all, one mark, one travelling hairline | a place that can hold a frame alone | fill the silence |
| `index` | a contents page listing the film's own chapters | proof, abundance, a record | repeat a chapter name |
| `stack` | one word per line at 132 px, clipped reveal | a declaration | be subtle |
| `metric` | a 340 px figure, its unit, one hairline | a number that matters | show a number that does not |
| `grid` | four micro-scenes at once | evidence by quantity | show the same frame twice |
| `diptych` | place above, colour field below holding the line | a considered statement | echo `silent` |
| `caption` | broadcast lower third with a timecode | reportage, a place with a story | pretend to be editorial |
| `marquee` | type crossing the frame | momentum, an ending in motion | be readable in one glance |
| `signature` | the closing card | the last four seconds | ever move |

Casting rules:

- the hook is `stack`, `poster` or `editorial`;
- a place is `silent`, `caption`, `diptych` or `poster`;
- evidence is `grid`, `index` or `marquee`;
- a number is `metric` (a figure with no page is a missed beat);
- the end is always `signature`.

Two consecutive beats are never the same page, and a page chosen by the
director is checked against the same rule before it is honoured.

## Typography and colour in the pages

- One scale with real jumps: 118 / 92 / 64 / 46 / 28 / 13 px at 1080 wide.
  Nothing in between; intermediate sizes are what makes a layout look amateur.
- Numerals are `rl()`-converted in Arabic films, so a figure and its label are
  written in one script.
- Colour is a key, chosen once per film (green, blue, amber, violet, ice), then
  the beats alternate temperature: odd beats take the accent, even beats take
  `#2E63FF` at 11% in `screen`. The palette breathes instead of repeating.
- Grain is 0.019, never on every cut. A vignette is 0.42. Nothing else is added
  for texture; the geometry is the texture.
