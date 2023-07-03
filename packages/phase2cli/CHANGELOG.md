# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.4.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.2) (2023-05-31)

### Bug Fixes

-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))

## [0.4.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.1) (2023-05-31)

### Bug Fixes

-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))

## [0.4.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.0) (2023-05-19)

### Bug Fixes

-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))

## [0.3.5](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.5) (2023-05-17)

### Bug Fixes

-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))

## [0.3.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.2) (2023-05-17)

### Bug Fixes

-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))

## [0.3.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.1) (2023-05-16)

### Bug Fixes

-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))

## [0.3.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.2.0...v0.3.0) (2023-05-15)

### Features

-   add typedoc generation ([6fee9d4](https://github.com/privacy-scaling-explorations/p0tion/commit/6fee9d422f4331997ebdbc152ed0b3fd36f43ede))

### Bug Fixes

-   bump 0.3.0; minor missing imports for enums ([79faae9](https://github.com/privacy-scaling-explorations/p0tion/commit/79faae92a04f4b6976645057623cf8f951116eb2))
-   missing skipLibCheck option was causing docs script to exit ([7433e38](https://github.com/privacy-scaling-explorations/p0tion/commit/7433e38395382f9f49e7eb499cbfb114bd6efd58))
-   set cli as a es module ([37f4351](https://github.com/privacy-scaling-explorations/p0tion/commit/37f43518169194b39479cfc194ec8e29f3f88b3c))
-   wrong path for environment config file ([75bbd98](https://github.com/privacy-scaling-explorations/p0tion/commit/75bbd98b129754bbd93b0160afcdd1abd4e21f49))

## [0.2.0](https://github.com/quadratic-funding/mpc-phase2-suite/cli/compare/v0.1.0...v0.2.0) (2023-04-04)

### ⚠ BREAKING CHANGES

-   constants are now part of actions package

### Features

-   add public finalization beacon value and hash for final contribution ([74dfc07](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/74dfc074c745c385787c15d84dbfb5a3a5f20cf8))
-   add wasm support at setup time ([53eeddd](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/53eeddd14e18504ae81cae57c0ee846d4b9935ad))
-   enable creation of public attestation gist even after contribution ([54db59c](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/54db59cc7a07dd291e37df2b36f5c5b1a457eed2))
-   **verification:** implemented actions functions on phase2cli ([7ae6da3](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/7ae6da37201bb644bababa45adf40890173f2c25))

### Bug Fixes

-   **ceremony verification:** add missing d.ts files ([7cec92e](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/7cec92e99ded7a9295f3ba1020d16f0bb611eb58))
-   **ceremony verification:** remove redundant argument from export verifier function ([ec351de](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/ec351def2a1104b825ead8619d65215431b38abb))
-   error when building in CI; review suggestions ([c811c43](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/c811c43fa01f697b97856ae6cc80e8e87565139b))
-   make spinner to stop properly ([d47de71](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/d47de71fa63c3e4ffabdda4155d83debf2e4947f))
-   missing pre-condition when resuming during computing step; wrong pre-condition on related cf ([90c8729](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/90c87295b771d099cffc43880e4e962cd64fd330))
-   small bug fixes and minor changes ([0a0d44a](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/0a0d44aa4f74aea2140ee68bc5547009611f2372))
-   **verification:** amend after PR review ([35ecf47](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/35ecf47d90a1f173b1cbcfa338a8b528899633b2))
-   **verification:** fix wrong path in function call ([cc9a991](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/cc9a9916aeeca5de12a09bb053b213e3111522df))
-   wrong Date type for start/end ceremony dates expressed in ms ([655a02e](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/655a02ed33f8e36f9224a1c299320f9e50504955))
-   wrong version for peer dependency actions package ([4975d96](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/4975d96928ec2f02dab99c493f9b4e65ff6ec983))

### Code Refactoring

-   update and move constants to actions package ([e1a98a8](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/e1a98a8d4b33c589a4a32300e9ad03c9a647c05b))

## [0.1.0](https://github.com/quadratic-funding/mpc-phase2-suite/cli/compare/v0.0.1...v0.1.0) (2023-01-24)

### Features

-   **setup:** decoupling setup from the cli ([9e8b3df](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/9e8b3df4640facc35dbe79b19d8f436768f74c6d)), closes [#217](https://github.com/quadratic-funding/mpc-phase2-suite/cli/issues/217)

### Bug Fixes

-   major and minor bugs from contribute command refactoring PR ([3697c69](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/3697c69f959cc86cb966cab207f2e78bf25e8fbd)), closes [#247](https://github.com/quadratic-funding/mpc-phase2-suite/cli/issues/247)
-   missing parameter value when calling query method for getting documents ([38a16e6](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/38a16e6a3d5c3293ed7042e6f0129730b5a4424f))
-   missing path update when using a pre-computed zkey ([4c66929](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/4c66929f55ecc24dc8287952237d8bdf36170c0e))
-   missing status check for request ([802dd4a](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/802dd4a0ef5b69dfd9d2d8ac5f3349ec25f2982a))
-   remove duplicated code ([9bb4938](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/9bb49389c358ff2369a44f02866c56957c9173db))
-   remove oauth token when it is invalid ([056ab25](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/056ab25b247e06828724b1a8affe5f1755fe5862))

### Performance Improvements

-   use re-export instead of import/export ([e3ef96b](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/e3ef96bdd6807da985ec09db5730d75697ff55cf))

### Code Refactoring

-   **contribute:** refactoring the contribute command ([69947b5](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/69947b55b50bd07a30398523da45209bfc6a745d))
-   decouple finalize command; minor fixes ([dd0e7ee](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/dd0e7ee9ddbbe8c99c94cb87aeff9740affcb2a2))
-   decouple of observe command; minor fixes ([455e8b1](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/455e8b1fb48c4d7650d1417a367efd7cd34b58f1))
-   modularize clean command by moving files helpers to actions package; sync other commands ([06e31bf](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/06e31bfdef1df88ebdbd9afc3d4f55ef99713f3f))
-   monorepo config and e2e bootstrap; minor fixes and improvements ([cb25f4e](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/cb25f4e8e2f94ff7f9ab2587e91d5db6c5d6a982))
-   optimize auth command and related libraries separation; generalize core lib methods ([7bc462c](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/7bc462c56cd1c876622c80471c3ba34135890c0f))
-   **setup:** implemented review suggestions ([82c4ea1](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/82c4ea14b29776c4208ce78f84128ae233afcbe3))
-   **storage helpers:** refactoring storage helpers to accept extra arguments ([efe3088](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/efe30887c0110dca7686ef4502ad0c7591d7bdc4))

### Miscellaneous

-   lint and fix import ([44e6e6c](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/44e6e6c39cafc1c9a4644ff182d9f7d31acdb9e8))
-   missing doc reference for firebase app ([1fc12c9](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/1fc12c9f9cce2c1ea7860e5e835b8af789ce1f31))
-   remove author section from package.json and update license author ([ed0173a](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/ed0173a45ecd52836a7063817edee4cc4a89275f))
-   remove unnecessary values ([3deaf7f](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/3deaf7fcfaf7ccfdaf238eca5eca58bcc8026f3f))
-   removed unnecessary prebuild scripts; minor config for node version and main entry point ([7385223](https://github.com/quadratic-funding/mpc-phase2-suite/cli/commit/7385223e2d168179390a14536dd0683ea0bb9e68))
