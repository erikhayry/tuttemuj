import { Runtime } from "foldkit";
import { init, Message, Model, update, view } from "./main.ts";

// A Foldkit app is four things: a Model (state), `update` (state + Message -> new state), `view`
// (state -> HTML) and `init`. Like Redux/Elm: the view never changes state, it only sends Messages.
const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  container: document.getElementById("root"),
  devTools: { Message },
});

Runtime.run(application);

// The service worker makes the app installable and keeps the app shell available offline.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js");
}
