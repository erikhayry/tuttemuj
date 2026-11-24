// The app's pieces, one file each (the way Foldkit's own larger examples are laid out):
//   model.ts    state and its schemas, plus `init`
//   message.ts  everything that can happen
//   update.ts   (state, message) -> new state and Commands
//   command.ts  side effects: asking for the position, calling the API
//   view/       state -> HTML
// This file only gathers them for entry.ts.

export { Message } from "./message.ts";
export { init, Model } from "./model.ts";
export { update } from "./update.ts";
export { view } from "./view/view.ts";
