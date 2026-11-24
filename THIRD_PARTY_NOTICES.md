# Third-party notices

Project-authored material uses the root OpenMDW 1.1 license. Third-party
source, assets and dependencies retain the licenses and attribution listed below.
Existing source copyright and license headers are retained.

## Campus election portal

The PHP application comes from
[Candida18/Online-Voting-System](https://github.com/Candida18/Online-Voting-System/tree/a34f604cb89d70c3dc003b81ea74eb6c0f501b78),
revision `a34f604cb89d70c3dc003b81ea74eb6c0f501b78`, under Apache License 2.0.
Its license and modification notice are retained beside the application at
`environments/tasks/campus-election-portal/environment/voting/site/`.
The adapted header and configuration files carry modification comments. Synthetic
election seed data and a generic profile image support the reconstructed fixture.

The retained frontend assets have the following notices. Their original source
headers remain in the task, and full license texts are included here:

| Component | License text |
| --- | --- |
| Bootstrap 3.3.7 | [MIT](LICENSES/bootstrap-3.3.7-MIT.txt) |
| normalize.css 3.0.3 | [MIT](LICENSES/normalize-3.0.3-MIT.txt) |
| jQuery 3.2.1 | [MIT](LICENSES/jquery-3.2.1-MIT.txt) |
| jQuery UI 1.11.4 | [MIT](LICENSES/jquery-ui-1.11.4-MIT.txt) |
| DataTables 1.10.16 and Bootstrap integration | [MIT](LICENSES/datatables-1.10.16-MIT.txt) |
| AdminLTE 2.4.0 | [MIT](LICENSES/adminlte-2.4.0-MIT.txt) |
| FastClick 1.0.6 | [MIT](LICENSES/fastclick-1.0.6-MIT.txt) |
| Moment 2.18.1 | [MIT](LICENSES/moment-2.18.1-MIT.txt) |
| Chart.js 1.0.2 | [MIT](LICENSES/chartjs-1.0.2-MIT.txt) |
| bootstrap-datepicker 1.7.1 | [Apache 2.0](LICENSES/bootstrap-datepicker-1.7.1-Apache-2.0.txt) |
| Date Range Picker 2.1.25 | [MIT](LICENSES/daterangepicker-2.1.25-MIT.txt) |
| iCheck 1.0.2 | [MIT](LICENSES/icheck-1.0.2-MIT.txt) |
| jQuery slimScroll 1.3.8 | [MIT option of MIT/GPL dual license](LICENSES/slimscroll-1.3.8-MIT.txt) |
| bootstrap-timepicker | [MIT](LICENSES/bootstrap-timepicker-MIT.txt) |
| Font Awesome 4.7.0 CSS | [MIT](LICENSES/font-awesome-4.7.0-MIT.txt) |
| Font Awesome 4.7.0 fonts | [SIL Open Font License 1.1](LICENSES/SIL-OFL-1.1.txt) |

Font Awesome attribution: Dave Gandy; see the
[upstream 4.7.0 license declaration](https://github.com/FortAwesome/Font-Awesome/tree/v4.7.0#license).

## Points transfer diagnostics

PAYGoat retains its MIT license, Copyright (c) 2025 Cesar Calderon, at
`environments/tasks/points-transfer-diagnostics/environment/player/PAYGoat/LICENSE`.
Its vendored Bootstrap 5.3.3 and Bootstrap Icons 1.10.5 retain the Bootstrap Authors'
copyright notices and [Bootstrap MIT](LICENSES/bootstrap-5.3.3-MIT.txt) and
[Bootstrap Icons MIT](LICENSES/bootstrap-icons-1.10.5-MIT.txt) license texts.

## Voting profile and election readiness frontends

`voting-profile-update` and `election-portal-readiness` retain a compiled frontend
with the following runtime packages. Complete upstream license texts, including
copyright and icon attribution, are retained under `LICENSES/`:

| Component | License text |
| --- | --- |
| @noble/curves 2.2.0 | [MIT](LICENSES/noble-curves-2.2.0-MIT.txt) |
| @noble/hashes 2.2.0 | [MIT](LICENSES/noble-hashes-2.2.0-MIT.txt) |
| clsx 2.1.1 | [MIT](LICENSES/clsx-2.1.1-MIT.txt) |
| framer-motion 12.38.0 | [MIT](LICENSES/framer-motion-12.38.0-MIT.txt) |
| lucide-react 1.14.0 | [ISC and retained icon attribution](LICENSES/lucide-react-1.14.0-ISC.txt) |
| motion-dom 12.38.0 | [MIT](LICENSES/motion-dom-12.38.0-MIT.txt) |
| motion-utils 12.36.0 | [MIT](LICENSES/motion-utils-12.36.0-MIT.txt) |
| React 19.2.5 | [MIT](LICENSES/react-19.2.5-MIT.txt) |
| React DOM 19.2.5 | [MIT](LICENSES/react-dom-19.2.5-MIT.txt) |
| React Router 7.14.2 | [MIT](LICENSES/react-router-7.14.2-MIT.txt) |
| React Router DOM 7.14.2 | [MIT](LICENSES/react-router-dom-7.14.2-MIT.txt) |
| scheduler 0.27.0 | [MIT](LICENSES/scheduler-0.27.0-MIT.txt) |
| tailwind-merge 3.5.0 | [MIT](LICENSES/tailwind-merge-3.5.0-MIT.txt) |
| Tailwind CSS 4.2.4 generated styles | [MIT](LICENSES/tailwindcss-4.2.4-MIT.txt) |

[frontend-license-sources.json](LICENSES/frontend-license-sources.json) records
the pinned package license URLs.

## Components fetched during setup or builds

The nightly object-store backup task builds MinIO from
[`RELEASE.2025-09-07T16-13-09Z`](https://github.com/minio/minio/tree/RELEASE.2025-09-07T16-13-09Z)
during its container build. MinIO is AGPL-3.0 licensed. The task includes a
Dockerfile that fetches and compiles this pinned source. Consult the upstream
license when building or redistributing resulting images.

Harbor, agent CLIs, operating-system images, Caddy, language runtimes, package
dependencies and system tools retain their applicable licenses. The repository
includes build recipes with digest-pinned public Docker Hub references.
Docker/BuildKit retrieves required images during builds, and the player recipes
install tools and configure users on public Debian/Kali images.

Fixture accounts, business records, passwords and generated certificates are
synthetic task material or retained public demonstration examples.
