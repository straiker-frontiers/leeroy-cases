UI regression profile
----------------------
This Chromium profile is kept logged in to the staging Gitea instance
so the nightly UI test runner does not have to re-auth every run.
Session belongs to alex.morgan (test owner account used for review/merge
UI flows). Refresh by re-running qa/relogin.sh if Gitea says the
session expired.

Do not commit new cookies here manually -- let the test runner refresh
the profile automatically.
