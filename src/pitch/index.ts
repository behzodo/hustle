import "server-only";

/**
 * The pitch lane.
 *
 * The build lane ends with seventy-three finished websites at real addresses
 * and no way to tell anybody they exist. This is that: find an address, write
 * one email, check it, send it from the user's own Gmail, and keep the thread
 * so a reply can be read against what it is replying to.
 *
 * Two things about it are worth knowing before reading the parts.
 *
 * The first is that there is no email address anywhere in a Google Maps
 * listing. Not a missing one — the field does not exist. So `find-email.ts`
 * goes and looks on whatever page the business does have, and comes back
 * empty more often than not, and a good share of every patch will only ever be
 * reachable by hand or by phone. That is a fact about the data, not a gap in
 * the code, and the screen has to show it rather than hide it.
 *
 * The second is legal, and it is not finished. A cold commercial email needs a
 * working opt-out — that is in `write.ts`, in the sign-off, and it is a real
 * one — but CAN-SPAM in the United States also requires a valid physical
 * postal address in the message, and the profile does not hold one. Before
 * this is used at volume against US businesses, the onboarding needs an
 * address field and `signOff` needs to print it. It is one field and one line;
 * it is written down here so it is not discovered later.
 */

export { findEmail, emailFromHtml, type FoundEmail } from "./find-email";
export { writePitch, type ComposedPitch, type PitchFacts, type Sender } from "./write";
export { checkPitch, type PitchProblem, type PitchSeverity } from "./check";
export { sendMail, readThread, stripQuoted, type Incoming, type Sent } from "./gmail";
export { readReply, type Reading, type Verdict } from "./read-reply";
export { writeAnswer, canAnswer, type Answered } from "./answer";
