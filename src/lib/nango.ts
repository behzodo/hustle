// Nango holds the Google OAuth tokens and refreshes them; the app only ever
// keeps a connection id. Nothing here removes the need for our own Google
// Cloud OAuth client — Nango runs the flow, Google still reviews the app.

/** Nango's provider key for Gmail. */
export const GMAIL_INTEGRATION_ID = "google-mail";

export const NANGO_SECRET_KEY = process.env.NANGO_SECRET_KEY;

/** Configured only once the Nango keys are present in the environment. */
export const isNangoConfigured = () => Boolean(NANGO_SECRET_KEY);
