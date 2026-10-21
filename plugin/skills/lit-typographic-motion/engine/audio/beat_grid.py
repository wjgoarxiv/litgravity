"""Tier 2 timing for lit-typographic-motion: a librosa beat grid for one audio file.

Runs inside the LitGravity motion venv created by `node <skill>/scripts/motion-runtime.mjs install --audio`
(pinned, hash-checked wheels). It analyses the user's own audio once, before any frame is
rendered, and writes a small JSON the engine reads through its beat interface. The JSON is a
build artifact of this run only (MO-A-17): never cached across briefs, never checked in.

Usage: python beat_grid.py <audio> <out.json>
"""

import json
import sys


def main(argv):
    if len(argv) != 3:
        print("usage: beat_grid.py <audio> <out.json>", file=sys.stderr)
        return 2
    import librosa
    import numpy as np

    path, out = argv[1], argv[2]
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration = float(len(y) / sr)
    hop = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop, units="frames")
    beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop).tolist()
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop, units="time").tolist()
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    fps = sr / hop

    def norm(values):
        arr = np.asarray(values, dtype=float)
        peak = float(arr.max()) if arr.size else 0.0
        return (arr / peak).round(4).tolist() if peak > 0 else arr.tolist()

    result = {
        "schema": "litgravity.motion-beat-grid/v1",
        "source": "librosa " + librosa.__version__,
        "duration": round(duration, 4),
        "tempo": round(float(np.atleast_1d(tempo)[0]), 3),
        "beats": [round(b, 4) for b in beats],
        "downbeats": [round(b, 4) for b in beats[::4]],
        "onsets": [round(o, 4) for o in onsets],
        "envelopeFps": round(float(fps), 4),
        "envelopes": {"rms": norm(rms), "onset": norm(onset_env)},
    }
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(result, handle)
    print(f"beat grid: {len(beats)} beats, tempo {result['tempo']} BPM, {duration:.2f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
