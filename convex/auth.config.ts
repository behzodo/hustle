// Clerk stays the identity provider — this only teaches Convex how to verify
// the tokens Clerk already issues. `domain` is the Clerk Frontend API URL and
// `applicationID` must match the JWT template name created in the Clerk
// dashboard (Configure -> JWT Templates -> New template -> Convex).
//
// Set CLERK_JWT_ISSUER_DOMAIN on the deployment:
//   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
