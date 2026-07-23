// Bump this whenever the /personvern notice text materially changes — users
// who acknowledged an older version are re-gated until they acknowledge the
// new one. NOT a semver; just a stable identifier for "which text did they
// see". TEMPLATE TEXT: the actual notice at app/personvern/page.tsx is
// generic placeholder language and needs a legal/customer review before a
// real go-live (data controller identity, DPO contact, exact retention
// period are customer-specific facts this codebase cannot know).
export const CURRENT_PRIVACY_NOTICE_VERSION = "2026-07-v1";
