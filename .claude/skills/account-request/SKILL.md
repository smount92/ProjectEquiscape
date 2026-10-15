---
name: account-request
description: Use when a member can't log in, wants to change their email or alias, wants their account deleted, wants a copy of their data, or asks what we hold about them.
---

# Handle an account request

**Never handle passwords**, never reset one for a member, never type
credentials anywhere. Members reset their own password from the login page.

| Request | What happens |
|---|---|
| Can't log in | Password reset from the login page. If the email never arrives, check the email provider (Resend) and spam. A suspended account is `moderation-report`. |
| Change email or alias | Settings. If Settings fails, `investigate-bug`. |
| Delete my account | Self-serve in Settings: soft delete, profile anonymized, login blocked. Their horses' Hoofprint history stays as an anonymous record. The privacy page still sends people to the contact form for this; point them to Settings. |
| My data | Settings › Export. |
| What do you hold about me | Answer from the privacy page; the owner replies. |

## Steps

1. Confirm the request came from the account's own email or a logged-in message, never from a third party.
2. Point the member to the self-serve path first; act for them only if it fails.
3. Draft the reply; the owner sends it. Keep it free of other members' details.
