import { createPatch } from "rfc6902";

export function getStateDiff(newState, oldState) {
  return createPatch(oldState, newState);
}
