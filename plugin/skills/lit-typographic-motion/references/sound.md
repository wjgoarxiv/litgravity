# Sound

Every film gets a sound plan in `treatment.json` (`sound: { mode, plan, genre?, palette?, events }`), on
both render paths. The renderer muxes whatever track the plan names, then audits the decoded stream
after the encode. Nothing here downloads a sample, a model or a library, and nothing borrows a melody:
the score and the bed are synthesized in product code, deterministically, from the treatment.

## Modes

| `sound.mode` | What is muxed | When |
| --- | --- | --- |
| `score` | A layered score built for this film: drums, bass, chords, lead, arrangement FX and the on-screen events as separate stems, mixed and mastered | The default under a bare `lit`, on the type path and the stage path alike |
| `generated` | One of the style's preset beds: a pad chord progression with a pulse and the accents the beats ask for | Minimal films only (`register: minimal`) |
| `supplied` | The user's own audio file (`sound.file`), padded or trimmed to the film | The user gave a track |
| `authored` | A WAV the model wrote itself into the stage dir (`sound.file`) | The treatment calls for sound the bed cannot make |
| `none` | No audio stream | Only when the user asked for silence, or the `channel` plays muted by design |

A supplied or authored track is always muxed, whatever the state of the optional audio-analysis
tier; that tier only adds a beat grid for timing. Say in the reply that the score or bed is
generated, in plain words ("an original score generated for this film"), and name any supplied track
by its file name.
Never switch a film to `none` to get past a check: that is a downgrade and the done-check records it.

## Score

The score is produced like a house track, from the film itself, so two films never share one.

- **Genre.** `house` (120-126 BPM, four-on-the-floor, offbeat bass), `tech-house` (124-128, rolling
  sixteenth bass), `deep-house` (118-122, pads, light swing) or `garage` (130-134, broken kick, heavy
  swing). The style picks one (swiss-signal house, terminalcore tech-house, tidal deep-house, paper
  garage); `sound.genre` names another when the film asks for it. Launch and hero films stay in
  house or tech-house.
- **Key, tempo, progression.** Seeded from the film's request, idea, turn, protagonist and beats:
  one of twelve keys, major or minor, a tempo inside the genre's band and one of six progressions per
  mode with sevenths and ninths. The last bar resolves home.
- **Arrangement from the beats.** The shots before `story.beat` are the intro and the build; the drop
  lands on the turn, on a downbeat (the bar grid is placed so a bar line falls on the turn's `t0`);
  with three or more shots after the turn the first is a break and the rest drop again; the last shot
  is the outro. A riser runs into every section change (two bars into the drop), an impact lands on the
  drop, a downlifter follows it, a reverse swell of the coming chord breathes into every other change,
  the kick drops out for the half bar before the drop, and the snare rolls
  into it.
- **Stems.** `kick`, `clap`, `hats` (closed and open), `perc`, `bass` (sub and line), `chords` (stab or
  pad), `lead` (a motif from the key's pentatonic), `fx` (risers, downlifters, impacts, reverse swells)
  and `events` (the on-screen events), each its own buffer with its own pattern.
- **Mix.** Per-stem gain and pan, a high-pass on every stem but kick and bass, the bass, chords and lead
  ducked under the kick (sidechain, measured and reported in dB), sends to a reverb and a tempo delay
  (dotted eighth left, eighth right), bus compression, then the shared master stage below.

Write `sound.plan` as the producer's brief for this film (what the drop is, where it breaks), and
the beats' `sound` fields with the cue words below. `motion.mjs sound` writes `sound/score.wav`, every
stem and both returns as `sound/stems/<name>.wav`, and `sound-cues.json` with the genre, key, tempo,
progression, sections, FX, each stem's level, the sidechain depth, the bus settings and every cue.

## Palettes (minimal films)

`sound.palette` is `{ "timbre": "<timbre>", "key": "<pitch class>", "mode": "<major|minor>", "tempo": <60-160> }`.
The key is one of the twelve pitch classes (sharps or flats), the mode sets the chord
progression (major: I–V–vi–IV; minor: i–VI–III–VII, always resolving home on the last chord), and
the tempo sets the pulse grid in BPM. A minimal film's generated bed takes one of the house style's beds exactly
(`studio.md`); the first is the default, and the other two let two films in one style differ:

| Style | Default bed | Alternatives |
| --- | --- | --- |
| `swiss-signal` | glass, A minor, 104 | pulse-synth, D minor, 112; soft-keys, C major, 96 |
| `tidal` | felt-strings, D major, 84 | glass, F# minor, 76; soft-keys, Bb major, 72 |
| `terminalcore` | pulse-synth, E minor, 120 | glass, B minor, 132; pulse-synth, A minor, 100 |
| `paper` | soft-keys, F major, 96 | felt-strings, G major, 88; glass, C major, 108 |

Pick the bed for the film's mood and pace: a slower or tenderer film takes the slower bed, a launch
the brighter one. Two films in one style still sound like one house; the beds, the beats' cue words
and the events make each film's sound its own.

| Timbre | Character | Pad | Pulse | Accents |
| --- | --- | --- | --- | --- |
| `soft-keys` | Warm, close, unhurried | Rounded electric-piano partials, gently detuned, low-passed | A felt kick on every beat | Felt piano strike for cadences; a soft noise-and-thump hit |
| `glass` | Bright, airy, precise | Bell-like odd partials with an octave shimmer, wide detune | A small tick on every beat and a sub note every bar | Inharmonic bell partials for hits and cadences |
| `pulse-synth` | Driving, graphic | Filtered saw pad | Eighth-note bass on the chord root under a firm kick | Plucked saw cadence; a noise snap hit; a pitched riser |
| `felt-strings` | Slow, tender, wide | Bowed-string partials with vibrato | A brushed noise pulse on every beat | A felt strike for cadences; a soft hit |

`soft-keys` carries the warm paper style, `felt-strings` the calm tidal one, `glass` the precise
swiss-signal one and `pulse-synth` the terminal one.

## Cues

Accents appear only where a beat's free-text `sound` field asks for one. The words that ask are:

- **hit** — hit, impact, cut, stab, accent, 타격, 히트, 컷, 강세. The hit lands on the cut nearest
  the beat's start when one is within 0.5 s, otherwise on the beat's start.
- **rise** — rise, riser, swell, build, build-up, lift, 상승, 고조, 빌드업. A filtered noise swell
  that ends exactly on the beat's end boundary (the next change) and starts up to 1 s before it.
- **cadence** — cadence, resolve, resolution, close, ending, final chord, 종지, 마무리, 해결. A struck
  tonic chord at the start of the beat's last 40 %, ringing into the film's end on the last beat.

A beat whose `sound` field names none of these gets pad and pulse only.

## Events

Cue words tie accents to cuts. Events tie sounds to what moves inside a shot: a latch clicks when the
lid opens, a card lands, a cursor types, a progress bar completes. A score or generated bed on the stage
path lists them in `sound.events`:

```json
"events": [{ "t": 6.42, "on": "the lid clicks open", "kind": "tap" }]
```

- `t`: the second the event happens on screen, read from the page's own timing (the same expression
  the page draws with), never guessed from the beat;
- `on`: what happens at that frame, as a viewer would see it;
- `kind`: `tap` (a short click with a pitched body: a key, a latch, a landing), `hit` (the cut hit),
  `whoosh` (air that ends on the event: something flies in) or `chime` (two notes of the key:
  something completes).

At least two events, and at least half of them 0.1 s or more away from every cut, so the sound follows
the picture rather than only the edit. An event never snaps to a cut: it sounds at its own `t`. Each
one appears in `sound-cues.json` as `kind: "event"` with `sound`, `on` and `fromCut`. `sound-cues.json` lists
every cue with `kind`, `t` (seconds), `beatIndex`, `target` (the beat boundary or cut it serves)
and `delta` (`t − target`), plus the palette, key, tempo, loudness, peak, sample count and the
bed's sha256. Look question 6 ("does the sound follow the cuts and the events?") is answered from
this file and the stills: each asked-for accent should sit on its cut with a delta within one frame,
every cut the treatment marks for sound should have a cue, and each event's frame should show what its
`on` says.

## Loudness and limits

- 48 kHz, 16-bit, stereo WAV of exactly `round(frameCount × 48000 / fps)` samples.
- Integrated loudness −16 LUFS ± 2, measured in product code per ITU-R BS.1770-4 (K-weighting at
  48 kHz, 400 ms blocks with 75 % overlap, −70 LUFS absolute and −10 LU relative gates). A
  deterministic lookahead limiter (5 ms ahead, both channels linked, 80 ms release) keeps the track's
  sample peak at or under −2 dBFS by turning the gain down before a peak, never by bending the
  waveform, so the AAC encode does not push the decoded peak over the audit's −0.5 dBFS.
- The intro is audible from the first quarter second, so the track never opens on silence.
- The muxed stream is decoded and gated when `mode` is not `none`: a stream is present, its
  duration is within ±0.1 s of the video, and its sample peak is at or under −0.5 dBFS. For a
  score or a generated bed, no stretch below −50 dBFS RMS (50 ms windows) may last longer than 1.5 s in the
  first 3 s; that failure, or a missing stream when sound was planned, is exit 20
  (`SOUND_INVALID`). For a supplied or authored track the head rule only warns.
- Audio is encoded as AAC at 256 kb/s. A supplied or authored track is padded or trimmed to the
  video's duration with a 50 ms fade; the encode never uses `-shortest`, so the audio can never cut
  the film short.

## Commands

```bash
node "$SKILL_ROOT/scripts/motion.mjs" sound --out <dir>
```

reads `<dir>/treatment.json` and writes the score (`<dir>/sound/score.wav` and its stems) or a minimal
film's bed (`<dir>/sound/bed.wav`), and `<dir>/sound-cues.json`, so the track can be heard and its cues
checked before a render. The render rebuilds the track at the film's exact frame count and cut times,
so the muxed track always matches the film sample for sample. Two builds from the same treatment give
the same bytes.
