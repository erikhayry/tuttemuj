import type { Html } from "foldkit/html";
import type { Model } from "../model.ts";
import type { H } from "./shared.ts";

export const savedView = (model: Model, h: H): Html =>
  model.saved.length === 0
    ? h.empty
    : h.section(
        [h.Class("card")],
        [
          h.h2([h.Class("section-title")], [`Saved: ${model.saved.length}`]),
          h.ul(
            [],
            model.saved.map((s) => h.li([], [`${s.name} (${s.location.lat}, ${s.location.lng})`])),
          ),
          h.p([h.Class("muted")], ["Tell Claude “stop” to build, commit and push."]),
        ],
      );
