// Starter scene registry. Brief shots name one of these ids.
import TitleSlam from "./title-slam.mjs";
import KaraokeLine from "./karaoke-line.mjs";
import KineticList from "./kinetic-list.mjs";
import NumberCounter from "./number-counter.mjs";
import Signature from "./signature.mjs";
import EndCard from "./end-card.mjs";

export const SCENES = Object.freeze({
  "title-slam": TitleSlam,
  "karaoke-line": KaraokeLine,
  "kinetic-list": KineticList,
  "number-counter": NumberCounter,
  signature: Signature,
  "end-card": EndCard,
});
