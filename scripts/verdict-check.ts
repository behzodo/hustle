/**
 * Reads a pile of real-sounding replies and prints what each one was taken to
 * mean.
 *
 * The split that matters is `deal` against `keen`: an invoice raised in answer
 * to "how much?" is a lost job, and no amount of prompt wording is worth
 * trusting on that without seeing it run.
 *
 *   npm run verdict:check
 */
import { readReply } from "../src/pitch/read-reply";

const CASES: [string, string][] = [
  ["deal", "yes go ahead, send me the invoice"],
  ["deal", "looks great, I'll take it. how do I pay?"],
  ["deal", "ok lets do it"],
  ["keen", "how much is it?"],
  ["keen", "interesting. what would it cost me?"],
  ["keen", "can you call me tomorrow to talk about it"],
  ["changes", "nice but the phone number is wrong and we close at 6 not 5"],
  ["changes", "can you put our menu on there"],
  ["question", "who is this and where did you get my number"],
  ["cool", "we're not looking for a website right now, thanks though"],
  ["stop", "no thanks"],
  ["stop", "take me off your list"],
  ["auto", "Thank you for your email. I am out of the office until Monday."],
  ["bounced", "Delivery has failed to these recipients or groups: address not found"],
];

const main = async () => {
  let wrong = 0;

  for (const [expected, text] of CASES) {
    const reading = await readReply(text);
    const ok = reading.verdict === expected;
    if (!ok) wrong += 1;

    console.log(
      `${ok ? "ok  " : "WRONG"} ${expected.padEnd(9)} got ${reading.verdict.padEnd(9)} ` +
        `${reading.asked ? "model " : "pattern"}  ${text.slice(0, 46)}`,
    );
  }

  console.log(`\n${CASES.length - wrong}/${CASES.length} read correctly`);
};

void main();
