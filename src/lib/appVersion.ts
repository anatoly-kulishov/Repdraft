/**
 * Build-time app version from package.json.
 * Release tags must match: `v${APP_VERSION}` (see release-branches).
 */
export const APP_VERSION: string = import.meta.env.PUBLIC_APP_VERSION;

/** Display label, e.g. `v0.12.4`. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
