/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as discovery from "../discovery.js";
import type * as domains from "../domains.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_places_index from "../lib/places/index.js";
import type * as lib_places_overpass from "../lib/places/overpass.js";
import type * as lib_places_scrapedo from "../lib/places/scrapedo.js";
import type * as lib_places_serper from "../lib/places/serper.js";
import type * as lib_places_types from "../lib/places/types.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as mailboxes from "../mailboxes.js";
import type * as messages from "../messages.js";
import type * as pitches from "../pitches.js";
import type * as profiles from "../profiles.js";
import type * as projects from "../projects.js";
import type * as sites from "../sites.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  credits: typeof credits;
  crons: typeof crons;
  discovery: typeof discovery;
  domains: typeof domains;
  feedback: typeof feedback;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/places/index": typeof lib_places_index;
  "lib/places/overpass": typeof lib_places_overpass;
  "lib/places/scrapedo": typeof lib_places_scrapedo;
  "lib/places/serper": typeof lib_places_serper;
  "lib/places/types": typeof lib_places_types;
  "lib/pricing": typeof lib_pricing;
  mailboxes: typeof mailboxes;
  messages: typeof messages;
  pitches: typeof pitches;
  profiles: typeof profiles;
  projects: typeof projects;
  sites: typeof sites;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
