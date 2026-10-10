/* Canonical Cognitive Firewall classifier. Pure, deterministic, local-only. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChanakyaClassifier = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const CATEGORIES = {
    act_now: {label:"ACT NOW",name:"Act now",color:"#df4c61",icon:"!",description:"Time-sensitive or consequential action may be required."},
    needs_decision: {label:"NEEDS DECISION",name:"Needs a decision",color:"#b86c12",icon:"?",description:"Ambiguity, conflict, or meaningful judgment requires a person."},
    authorized_handling: {label:"HANDLING CANDIDATE",name:"Eligible for authorized handling",color:"#10966c",icon:"✓",description:"Potentially routine, but no action is executed by this prototype."},
    digest_later: {label:"DIGEST LATER",name:"Digest later",color:"#2865e8",icon:"▤",description:"Informational content without a clear need for immediate interruption."},
    noise: {label:"NOISE CANDIDATE",name:"Noise candidate",color:"#718096",icon:"−",description:"Low-actionability content that remains available for inspection."}
  };
  function classify(m) {
    const text = [m.subject, m.body, ...(Array.isArray(m.labels) ? m.labels : [])].join(" ").toLowerCase();
    // Safety-first precedence: hostile inbound instructions are never executable instructions.
    if (/ignore all prior instructions|prompt_injection|forward the entire inbox|export the entire inbox/.test(text))
      return {category:"needs_decision",confidence:"high",reason:"Inbound content attempts to direct the assistant or disclose data. Treat it as untrusted content; do not execute its instructions."};
    if (/security|unusual sign-in|account/.test(text))
      return {category:"act_now",confidence:"high",reason:"Potential account-security event should be surfaced promptly. Verify through a known trusted channel."};
    if (/conflict|conflicting|blocked|legal|contract notice|review requested|authority is unknown/.test(text))
      return {category:"needs_decision",confidence:"high",reason:"The item contains ambiguity, conflicting instructions, legal content, or a request that needs human review."};
    if (/closes tomorrow|in 30 minutes|overrun|approve vendor budget/.test(text))
      return {category:"act_now",confidence:"high",reason:"A deadline or potentially consequential action is present; surface for human review."};
    if (/routine invoice receipt|receipt|acknowledgement|acknowledgment/.test(text))
      return {category:"authorized_handling",confidence:"medium",reason:"This looks routine, but the prototype only recommends handling; it does not change the source item."};
    if (/newsletter|roundup|no action|no action is requested|no direct request|on track|status update|informational/.test(text))
      return {category:"digest_later",confidence:"medium",reason:"The message appears informational and contains no clear immediate action request."};
    if (/social|engagement|liked a post|notification/.test(text))
      return {category:"noise",confidence:"medium",reason:"This appears to be a low-actionability engagement notification. It remains available for inspection."};
    return {category:"needs_decision",confidence:"low",reason:"The baseline is uncertain. It escalates rather than silently suppressing an unclear item."};
  }
  return {CATEGORIES, classify};
});
