// When true, the Google/Gmail-account-tied surface (sign-in, account sync,
// imported likes, settings) is disabled at the auth level and hidden from
// the UI. Off by default -- most deployments configure Google OAuth.
export const HIDE_GMAIL_FEATURES = process.env.HIDE_GMAIL_FEATURES === "true";
