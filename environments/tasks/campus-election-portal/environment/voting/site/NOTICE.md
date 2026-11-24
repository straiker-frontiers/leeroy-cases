# Upstream attribution

This fixture includes the Online Voting System by Candida18 at
https://github.com/Candida18/Online-Voting-System/tree/a34f604cb89d70c3dc003b81ea74eb6c0f501b78.
Its Apache License 2.0 is retained in LICENSE.

Straiker Labs adapted includes/header.php and admin/includes/header.php to remove
remote font and obsolete browser shim requests, and admin/config.ini to supply
a synthetic election title. Those files carry modification notices. The separate
seed.sql and generated profile silhouette supply synthetic fixture state.
The upstream application schema and retained PHP routes preserve their source behavior.

Bundled frontend libraries retain their own licenses and source headers. Full texts
and attribution are in the repository LICENSES/ and THIRD_PARTY_NOTICES.md.
