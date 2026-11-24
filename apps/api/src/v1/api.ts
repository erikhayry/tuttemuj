import {
  ButtonId,
  ButtonQuery,
  ButtonResultsResponse,
  ButtonsResponse,
  PlacesNearResponse,
  PositionQuery,
} from "@tuttemuj/schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api";

// The API is *defined* here, apart from the code that serves it (handlers.ts). One definition gives
// us request validation, the OpenAPI document and a typed client, and the Foldkit app (#60) can
// import this file without pulling in any server code. Compare with a tRPC router type or an
// OpenAPI file, except the schemas are the same Effect Schemas the rest of the project uses.

export class PlacesApiGroup extends HttpApiGroup.make("places").add(
  // Query values are checked against `PositionQuery`: out-of-range or missing lat/lng gives a 400.
  HttpApiEndpoint.get("near", "/places/near", {
    query: PositionQuery,
    success: PlacesNearResponse,
  }),
) {}

export class ButtonsApiGroup extends HttpApiGroup.make("buttons").add(
  HttpApiEndpoint.get("list", "/buttons", {
    query: ButtonQuery,
    success: ButtonsResponse,
  }),
  HttpApiEndpoint.get("results", "/buttons/:id", {
    // An id that is not one of the 10 buttons is rejected with a 400 before the handler runs.
    params: { id: ButtonId },
    query: ButtonQuery,
    success: ButtonResultsResponse,
  }),
) {}

export class SystemApiGroup extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", { success: HttpApiSchema.NoContent }),
) {}

export class Api extends HttpApi.make("tuttemuj")
  .add(PlacesApiGroup)
  .add(ButtonsApiGroup)
  .add(SystemApiGroup)
  .annotateMerge(
    OpenApi.annotations({
      title: "Tuttemuj API (v1)",
      description:
        "Answers for the 10 location buttons. Responses carry ids and data, never UI text. Every result links to its page on nykarlebyvyer.nu.",
    }),
  ) {}
