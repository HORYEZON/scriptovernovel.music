// lib/museum/sceneObjectKinds.ts
//
// Which MuseumSceneObject kinds are *configuration* rather than a placement.
//
// Most scene-object rows describe a thing standing somewhere in a room: a .glb
// prop, a text label, a divider wall. A few describe how the room draws
// something else — the Stories Room's pedestal model, the Cosplay Room's
// standee and backdrop, the room-wide plaque style every label reads. Those
// ride on the same table (and travel to the museum on the same list) because
// they are per-room settings with nowhere better to live, but their position
// columns are meaningless: nothing is ever drawn "there".
//
// Every consumer that walks a room's objects has to know the difference, and
// each one that forgot has produced the same class of bug: the scene rendering
// a config row as a stray .glb at the room's origin, or the minimap plotting a
// dot for an object no visitor can walk up to. Collected here so a new config
// kind is excluded everywhere by adding one entry, rather than by remembering
// every list that needs a new `continue`.
import { STORY_PODIUM_MODEL_KIND } from "./storyPodiumModel";
import { COSPLAY_STANDEE_MODEL_KIND } from "./cosplayStandee";
import { ROOM_BANNER_KIND } from "./roomBanner";

const CONFIG_ONLY_KINDS = new Set<string>([
  STORY_PODIUM_MODEL_KIND,
  COSPLAY_STANDEE_MODEL_KIND,
  ROOM_BANNER_KIND,
]);

/** True for a row that configures the room rather than standing in it — so it
 *  is never rendered as a prop, and never plotted on the minimap. */
export function isConfigOnlyKind(kind: string): boolean {
  return CONFIG_ONLY_KINDS.has(kind);
}
