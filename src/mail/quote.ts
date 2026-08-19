/**
 * Everything below this line is the email being replied to, not the reply.
 *
 * Every client quotes differently and none of them agree, so this matches the
 * three shapes that cover almost all of it: Gmail's "On <date> <name> wrote:",
 * a run of `>` quoting, and Outlook's horizontal rule of underscores. What is
 * left is what the person actually typed, which is the only part worth showing
 * or classifying.
 *
 * Its own file because both transports need it and the regex is subtle enough
 * that two copies of it would drift. It is also the single highest-leverage
 * function in the reply loop: everything downstream — the verdict, the answer,
 * whether an invoice is raised — is decided by a model reading whatever this
 * returns, and a quoted copy of our own pitch left on the front of it is a
 * model reading our words back and grading them as theirs.
 */
export const stripQuoted = (text: string) => {
  const cut = text.search(
    /^\s*(?:On .{5,120}wrote:|-{2,}\s*Original Message|_{5,}|From:\s.+<)/m,
  );

  const body = cut === -1 ? text : text.slice(0, cut);

  return body
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .trim();
};
