# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.0](https://github.com/quadratic-funding/mpc-phase2-suite/cli/compare/v0.0.1...v0.1.0) (2023-01-24)


### Features

* **setup:** decoupling setup from the cli ([9e8b3df](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/9e8b3df4640facc35dbe79b19d8f436768f74c6d)), closes [#217](https://github.com/quadratic-funding/mpc-phase2-suite/cli/issues/217)


### Bug Fixes

* major and minor bugs from contribute command refactoring PR ([3697c69](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/3697c69f959cc86cb966cab207f2e78bf25e8fbd)), closes [#247](https://github.com/quadratic-funding/mpc-phase2-suite/cli/issues/247)
* missing parameter value when calling query method for getting documents ([38a16e6](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/38a16e6a3d5c3293ed7042e6f0129730b5a4424f))
* missing path update when using a pre-computed zkey ([4c66929](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/4c66929f55ecc24dc8287952237d8bdf36170c0e))
* missing status check for request ([802dd4a](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/802dd4a0ef5b69dfd9d2d8ac5f3349ec25f2982a))
* remove duplicated code ([9bb4938](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/9bb49389c358ff2369a44f02866c56957c9173db))
* remove oauth token when it is invalid ([056ab25](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/056ab25b247e06828724b1a8affe5f1755fe5862))


### Performance Improvements

* use re-export instead of import/export ([e3ef96b](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/e3ef96bdd6807da985ec09db5730d75697ff55cf))


### Code Refactoring

* **contribute:** refactoring the contribute command ([69947b5](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/69947b55b50bd07a30398523da45209bfc6a745d))
* decouple finalize command; minor fixes ([dd0e7ee](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/dd0e7ee9ddbbe8c99c94cb87aeff9740affcb2a2))
* decouple of observe command; minor fixes ([455e8b1](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/455e8b1fb48c4d7650d1417a367efd7cd34b58f1))
* modularize clean command by moving files helpers to actions package; sync other commands ([06e31bf](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/06e31bfdef1df88ebdbd9afc3d4f55ef99713f3f))
* monorepo config and e2e bootstrap; minor fixes and improvements ([cb25f4e](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/cb25f4e8e2f94ff7f9ab2587e91d5db6c5d6a982))
* optimize auth command and related libraries separation; generalize core lib methods ([7bc462c](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/7bc462c56cd1c876622c80471c3ba34135890c0f))
* **setup:** implemented review suggestions ([82c4ea1](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/82c4ea14b29776c4208ce78f84128ae233afcbe3))
* **storage helpers:** refactoring storage helpers to accept extra arguments ([efe3088](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/efe30887c0110dca7686ef4502ad0c7591d7bdc4))


### Miscellaneous

* lint and fix import ([44e6e6c](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/44e6e6c39cafc1c9a4644ff182d9f7d31acdb9e8))
* missing doc reference for firebase app ([1fc12c9](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/1fc12c9f9cce2c1ea7860e5e835b8af789ce1f31))
* remove author section from package.json and update license author ([ed0173a](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/ed0173a45ecd52836a7063817edee4cc4a89275f))
* remove unnecessary values ([3deaf7f](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/3deaf7fcfaf7ccfdaf238eca5eca58bcc8026f3f))
* removed unnecessary prebuild scripts; minor config for node version and main entry point ([7385223](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/7385223e2d168179390a14536dd0683ea0bb9e68))
