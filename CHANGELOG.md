# Changelog

## [0.1.0](https://github.com/jonperron/bosco/compare/bosco-v0.0.1...bosco-v0.1.0) (2026-11-28)


### Features

* add readme ([1625e3b](https://github.com/jonperron/bosco/commit/1625e3bfc25af6170399d2a4bb59c5d0733916d8))
* **api:** NestJS skeleton with typed health route and OpenAPI contract ([#9](https://github.com/jonperron/bosco/issues/9)) ([338cea3](https://github.com/jonperron/bosco/commit/338cea36c0cee5e97f827c840a930120ab8ddd61))
* **api:** send security headers ([f9e05dc](https://github.com/jonperron/bosco/commit/f9e05dc5fdffc534ae51c162e5f6904f69afd630))
* **crypto:** add envelope encryption package for manager data ([8c8b5c4](https://github.com/jonperron/bosco/commit/8c8b5c470de870f67978fa2bfee78b71fc6ec094))
* **db:** add manager accounts, server-side sessions and migration lock ([e9cab19](https://github.com/jonperron/bosco/commit/e9cab194ab1db9c7efb90b409c0ec14991cc6a74))
* **db:** add the core schema, replayable migrations and demo seed ([6f64dd8](https://github.com/jonperron/bosco/commit/6f64dd86ef1d38c4d753d954e6e4cce6e55b7a0c))
* **db:** import people from csv ([801c61f](https://github.com/jonperron/bosco/commit/801c61f31abf680174c303e78f99d05dd9d88cbb))


### Bug Fixes

* allow english commits only and prevent merge on guardian PRs ([#6](https://github.com/jonperron/bosco/issues/6)) ([d5a77ad](https://github.com/jonperron/bosco/commit/d5a77ad1087cab2e3abc1da244ed3f47a0c3974b))
* **api:** reject unknown request fields ([b89756a](https://github.com/jonperron/bosco/commit/b89756a2a6676baf090904e4cb7a7369fce5ff44))
* **api:** scope hsts to the host and pin same-origin swagger scripts ([a65c13b](https://github.com/jonperron/bosco/commit/a65c13b4ef4f8db888c5aae39fc55433239228f3))
* **api:** serve spa deep links when the dist path has a dot segment ([d4f85ff](https://github.com/jonperron/bosco/commit/d4f85ffe10be3e58951bc3479962ba4df2348c25))
* **api:** show the startup log ([5dbd0e8](https://github.com/jonperron/bosco/commit/5dbd0e83ed01acf1528accbf1d79ee46c7115794))
* **api:** upgrade @nestjs/swagger to the Nest 11 line ([fb4986e](https://github.com/jonperron/bosco/commit/fb4986e96bec3f17ca4b1bb932c99815f404d882))
* **crypto:** harden recovery, rewrap and master key loading ([2ee4eb3](https://github.com/jonperron/bosco/commit/2ee4eb3a4c9f6518f711840b9c10ed5d8b8a77c5))
* **db:** date csv manager changes from the lock and keep emails ascii ([759f137](https://github.com/jonperron/bosco/commit/759f137b22f978ede9f7a64aab54aa2a32016ca7))
* **db:** harden session storage, lifetimes and the seed guard ([42cf16d](https://github.com/jonperron/bosco/commit/42cf16de8c1b57df93b45965ae40bd4fc6dd8abe))
* **db:** harden the demo seed and the integration setup ([d6b413e](https://github.com/jonperron/bosco/commit/d6b413e19ab0d9cfd3e4c8e13b89662a58eaf598))
* **db:** keep header cells out of csv import errors ([a2b09e4](https://github.com/jonperron/bosco/commit/a2b09e43679deda8ea6647535fe367b2b80d7cf6))
* **db:** reject control characters in imported display names ([9142842](https://github.com/jonperron/bosco/commit/914284281eaae319d838af469bd9baaf0ecb5710))
* **repo:** skip the release-please changelog in prettier ([04e7d7c](https://github.com/jonperron/bosco/commit/04e7d7c29e42dc6f90b75a97e91d1e43fd47a3a2))
* **web:** fall back to french when browser storage is blocked ([03a28fc](https://github.com/jonperron/bosco/commit/03a28fc596ad45b09855898ebf225b1a11187131))
* **web:** upgrade i18next to 27 for advisory GHSA-6jcc-5g8w-32mx ([35b796c](https://github.com/jonperron/bosco/commit/35b796cc0b1229d5d88be4491914c3a6a401e745))
