# Sound

Films have sound unless the user said otherwise. The treatment's `sound` object (`{ mode, plan, palette,
file }`) plans it on both paths, the renderer muxes the track the plan names, and after the encode it
decodes the film's audio stream and gates it. The generated bed is synthesized by LitGravity's own code from
the treatment: no sample library, model or package is downloaded for it, and the same treatment always
produces the same bytes.

## Choosing a mode

| `sound.mode` | Track | Use it when |
| --- | --- | --- |
| `generated` | A bed built from the treatment: a tempo grid, a pulse, a pad chord per beat, and the accents the beats ask for | The default under a bare `lit`, on either path |
| `supplied` | The user's file at `sound.file` (relative to the output folder), padded or trimmed to the film | The user handed over a track |
| `authored` | A WAV you wrote into the stage folder, named by `sound.file` | The plan needs sound the bed cannot make; the file must sit inside `<dir>/stage/` |
| `none` | No audio stream | The request asks for silence (무음, 소리 없이, silent, muted, no music …) or the `channel` plays muted by design |

A supplied or authored track is always muxed, whatever the state of the optional analysis tier below.
The reply calls a generated bed "a generated music bed" in plain words and names a supplied track by its
file name. Switching to `none` to get past a failing check is a downgrade: the done-check records it and the
reply has to admit it.

## The generated bed's palette

A generated bed needs `sound.palette`:

```json
{ "timbre": "<timbre>", "key": "<pitch class>", "mode": "<major or minor>", "tempo": "<60-160>" }
```

`key` is any of the twelve pitch classes, written with sharps or flats (`C`, `C#`, `Db` … `B`). `mode`
picks the progression: major walks I–V–vi–IV, minor walks i–VI–III–VII, one chord per treatment beat (a long
beat is split into two-bar chords), and the last chord always returns home. `tempo` is beats per minute
and sets the pulse grid from t = 0. An invalid palette stops the render with exit 16 naming the exact field
(`sound.palette.timbre`, `sound.palette.tempo` …).

Choose the four values for this film. A reflective portrait and a fast product cut should not share a
palette, and two films in a row should not sound like siblings.

| Timbre | Feel | Pad | Pulse | Accent voice |
| --- | --- | --- | --- | --- |
| `soft-keys` | warm, close, unhurried | rounded electric-piano partials, light detune, low-passed at 2.6 kHz | a felt kick on every beat | a felt piano strike |
| `glass` | bright, airy, exact | bell-like odd partials with an octave shimmer, open to 7 kHz | a small tick each beat, a sub note each bar | inharmonic bell partials |
| `pulse-synth` | driving, graphic | a filtered saw pad | eighth-note bass on the chord root under a firm kick | a plucked saw, a noise snap, a pitched riser |
| `felt-strings` | slow, tender, wide | bowed-string partials with vibrato | a brushed noise pulse each beat | a soft felt strike |

As a starting point: intimate or reflective films lean on `soft-keys` or `felt-strings`, clean diagrams and
precise explainers on `glass`, and graphic fast-cut pieces on `pulse-synth`.

## Asking for accents

The bed adds an accent only where a beat's `sound` text asks for one. It reads three kinds of word:

- **hit**: hit, impact, cut, stab, accent, 타격, 히트, 컷, 강세. The hit lands on the cut nearest the beat's
  start when one lies within 0.5 s, else on the beat's start.
- **rise**: rise, riser, swell, build, build-up, lift, 상승, 고조, 빌드업. A filtered noise swell that ends on
  the beat's end (snapped to a cut within 0.5 s) and starts up to 1 s before it, never before the beat.
- **cadence**: cadence, resolve, resolution, close, closing, ending, final chord, 종지, 마무리, 해결. A struck
  tonic chord at 60 % of the beat, ringing to the beat's end, or to the film's end on the last beat.

A beat that names none of these gets pad and pulse only. The cut times come from the beats on the stage
path and from the brief's shots on the type path.

`<dir>/sound-cues.json` records each cue with `kind`, `t` in seconds, `beatIndex`, `target` (the boundary or
cut it serves) and `delta` (`t - target`), alongside the timbre, key, tempo, loudness, peak, sample count
and the bed's SHA-256. Look question 6 ("does the sound follow the cuts?") is answered from this file: every
requested accent should sit on its target within one frame, and every beat whose text asked for an accent
should have one.

## Levels and length

- The bed is 48 kHz, 16-bit stereo, exactly `round(frameCount × 48000 / fps)` samples, so it matches the
  picture sample for sample.
- It is normalized to −16 LUFS integrated, measured in product code per ITU-R BS.1770-4 (K-weighting,
  400 ms blocks with 75 % overlap, the −70 LUFS absolute and −10 LU relative gates), through a
  deterministic soft limiter that keeps the sample peak at or under −2 dBFS.
- The pad sounds within the first quarter second; the bed never opens on silence.
- A supplied or authored track is converted to the film's exact length, with a 50 ms fade where it is
  trimmed or padded. The encode never uses `-shortest`, so audio can never cut the picture short.
- Audio is encoded as AAC at 256 kb/s.

## The sound gate

Whenever `mode` is not `none`, the renderer decodes the muxed stream and adds these rules to the gate:

| Rule | Passes when |
| --- | --- |
| `SOUND-STREAM` | an audio stream is present |
| `SOUND-DURATION` | its length is within ±0.1 s of the video |
| `SOUND-PEAK` | the sample peak is at or under −0.5 dBFS |
| `SOUND-HEAD` | no stretch below −50 dBFS RMS (50 ms windows) lasts longer than 1.5 s in the first 3 s |
| `SOUND-LOUDNESS` | reported; a generated bed outside −16 ± 2 LUFS warns |

A missing stream when sound was planned, or a silent head on a generated bed, is exit 20 `SOUND_INVALID`.
A silent head on a supplied or authored track only warns, since the user's music may open quietly. An
authored file outside the stage folder, or a track that cannot be read or converted, is also exit 20 with
the field named.

## Hearing it before the render

```bash
node "$SKILL_ROOT/scripts/motion.mjs" sound --out <dir>
```

This reads `<dir>/treatment.json` and writes `<dir>/sound/bed.wav` and `<dir>/sound-cues.json`, so the cue
deltas can be checked before any frame is captured. For a supplied, authored or silent plan it only reports
what the render will do. The full render rebuilds the bed itself at the film's real frame count and cut
times, so the muxed bed always fits the final cut.

## The optional analysis tier

On the type path a supplied track (or the brief's `audio` file) can drive shot timing through a beat grid
made by librosa. That tier lives in a separate venv that is installed once, from a terminal or as a `run_command` the user allows:

```bash
node "$SKILL_ROOT/scripts/motion-runtime.mjs" install --audio
```

It needs Python 3.10 or newer (`LITGRAVITY_MOTION_PYTHON` picks the interpreter) and installs hash-pinned wheels
into the LitGravity motion cache. Without it, or when analysis finds fewer than two beats, the render warns
and times shots by reading time (Tier 1); the track itself is still muxed. A render never installs the tier.
