import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "./fsjson.js";

export interface ShgState {
  lastDeviceId?: string;
  lastVariant?: string;
  lastFlavor?: string;
}

export function getStatePath(projectRoot: string): string {
  return join(projectRoot, ".shg", "state.json");
}

export function loadState(projectRoot: string): ShgState {
  return readJsonFile<ShgState>(getStatePath(projectRoot)) ?? {};
}

export function saveState(projectRoot: string, state: ShgState): void {
  writeJsonFile(getStatePath(projectRoot), state);
}
