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
