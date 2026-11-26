import type { Html } from "foldkit/html";
import type { Model } from "../model.ts";
import type { H } from "./shared.ts";

export const savedView = (model: Model, h: H): Html => {
  const lines = [
    ...model.saved.map((s) => `${s.name} (${s.location.lat}, ${s.location.lng})`),
    ...model.ignored.map((name) => `${name} (not in Nykarleby)`),
  ];
  return lines.length === 0
    ? h.empty
    : h.section(
        [h.Class("card")],
        [
          h.h2(
            [h.Class("section-title")],
            [`Saved: ${model.saved.length} · Not in Nykarleby: ${model.ignored.length}`],
          ),
          h.ul(
            [],
            lines.map((line) => h.li([], [line])),
          ),
          h.p([h.Class("muted")], ["Tell Claude “stop” to build, commit and push."]),
        ],
      );
};
