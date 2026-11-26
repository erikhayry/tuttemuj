import {
  CoordsNextRequest,
  CoordsNextResponse,
  CoordsSaveRequest,
  CoordsSaveResponse,
} from "@tuttemuj/schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

// The API definition, apart from the code that serves it (see apps/api/src/v1/api.ts). `payload` is
// the request body: it is checked against the schema before the handler runs.
export class CoordsGroup extends HttpApiGroup.make("coords").add(
  HttpApiEndpoint.post("next", "/next", {
    payload: CoordsNextRequest,
    success: CoordsNextResponse,
  }),
  HttpApiEndpoint.post("save", "/save", {
    payload: CoordsSaveRequest,
    success: CoordsSaveResponse,
  }),
) {}

export class CoordsApi extends HttpApi.make("coords").add(CoordsGroup) {}
