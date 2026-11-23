import type { Library } from "./library-model.mjs";
export function saveStatement(
  storage: Pick<Storage, "getItem" | "setItem">,
  change: (library: Library) => Library,
  messages?: {conflict?:string;write?:string},
): Library;
