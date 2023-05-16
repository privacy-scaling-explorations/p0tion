# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.3.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.1) (2023-05-16)


### Bug Fixes

* spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))



## [0.3.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.2.0...v0.3.0) (2023-05-15)

### Features

-   add typedoc generation ([6fee9d4](https://github.com/privacy-scaling-explorations/p0tion/commit/6fee9d422f4331997ebdbc152ed0b3fd36f43ede))

### Bug Fixes

-   add missing options to ts config ([9e05617](https://github.com/privacy-scaling-explorations/p0tion/commit/9e05617aaa8fb6ad4d20c72700a0793891598218))
-   bump 0.3.0; minor missing imports for enums ([79faae9](https://github.com/privacy-scaling-explorations/p0tion/commit/79faae92a04f4b6976645057623cf8f951116eb2))
-   wrong prod Firebase project for CI ([d740a90](https://github.com/privacy-scaling-explorations/p0tion/commit/d740a905e58a9273b31d153f802cbf156369f028))

## [0.2.0](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/compare/v0.1.0...v0.2.0) (2023-04-04)

### Features

-   add public finalization beacon value and hash for final contribution ([74dfc07](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/74dfc074c745c385787c15d84dbfb5a3a5f20cf8))
-   **multi part upload:** added more descriptive error messages and fixed test cases ([f1f9c64](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/f1f9c64da51c601bd9f4bc26165d59d8f7547e53))
-   **multi part upload:** added more descriptive error messages and fixed test cases ([e9ead57](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/e9ead57df45e57ab3917f02e0345e6fb0891c8b4))
-   **security rules:** implemented Firestore security rules ([7fb1c4a](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/7fb1c4abac8c02671046d9c2056911cffd188eac)), closes [#28](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/issues/28)

### Bug Fixes

-   cannot deploy cloud functions ([83f4928](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/83f4928367255b83c3a1c25c786f3ce395a02e48))
-   **ceremony verification:** add missing d.ts files ([7cec92e](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/7cec92e99ded7a9295f3ba1020d16f0bb611eb58))
-   **ceremony verification:** removed redundant cleanup on emulator ([5690748](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/5690748a9463d897f749410c06ac090af053f4de))
-   error when building in CI; review suggestions ([c811c43](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/c811c43fa01f697b97856ae6cc80e8e87565139b))
-   **generategetobjectpresignedurl:** implemented changes to restrict arbitrary access ([388caac](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/388caac7bb8a574f804639733738adcc3d730978)), closes [#309](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/issues/309)
-   missing pre-condition when resuming during computing step; wrong pre-condition on related cf ([90c8729](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/90c87295b771d099cffc43880e4e962cd64fd330))
-   **multipart upload:** fixed tests that failed due to the changes ([3e974f9](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/3e974f9c410afebf5b6cd952e1fcd80f06892468))
-   **multipart upload:** fixed tests that failed due to the changes ([eded975](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/eded975a42ed2d557c71c7e6592e2ae82fb46018))
-   **multipart upload:** lock down multipart upload ([407aaf0](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/407aaf012eb56a83944acbbca5e5028a4294174f))
-   **multipart upload:** lock down multipart upload ([5629dd7](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/5629dd78db426a897d6845263e8b7130f6c590cb))
-   **multipart upload:** shortening expression ([0c63567](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/0c6356733ba403a49b4ede5b066272d71b07d679))
-   **multipart upload:** shortening expression ([2562ec8](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/2562ec8c9545a7983b9dfdfb07c47c42438a1d8d))
-   next participant on the waiting queue did not automatically start the contribution ([7def977](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/7def977fb507182053c9a02b4484d2d2c260fcb4))
-   remove unnecessary kill command to clean CI ([809de02](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/809de028e179bcafd4840892130688186de3b8ab))
-   **security rules:** fixed Firestore security rules ([2bb85f2](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/2bb85f207ddcf5cc75b13b00ee82bcb51837d202))
-   **signedurls:** commiting correct .default.env file ([6fe96b1](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/6fe96b197661115979b1691d7d31b4b5ee5467ea))
-   small bug fixes and minor changes ([0a0d44a](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/0a0d44aa4f74aea2140ee68bc5547009611f2372))
-   **tests:** fixed failing tests and added more cleanup functions ([26baaec](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/26baaec4b5a697a62dc092503134124b6b15aa38))
-   **verification:** amend after PR review ([35ecf47](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/35ecf47d90a1f173b1cbcfa338a8b528899633b2))
-   wrong Date type for start/end ceremony dates expressed in ms ([655a02e](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/655a02ed33f8e36f9224a1c299320f9e50504955))
-   wrong import ([8fdc432](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/8fdc432994dbf73fbf8fa9b02b3887fd2d6c5a30))
-   wrong variable type lead to cfs inconsistency ([0003f4a](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/0003f4a8cf8127821a5e013b7a319d3fccf94381))
-   wrong version for peer dependency actions package ([4975d96](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/4975d96928ec2f02dab99c493f9b4e65ff6ec983))

## [0.1.0](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/compare/v0.0.1...v0.1.0) (2023-01-24)

### Features

-   a ([d5b8681](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/d5b868140968b9600ea82c502fd5c78c113a0f57))

### Bug Fixes

-   missing parameter value when calling query method for getting documents ([38a16e6](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/38a16e6a3d5c3293ed7042e6f0129730b5a4424f))
-   remove duplicated code ([9bb4938](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/9bb49389c358ff2369a44f02866c56957c9173db))
-   wrong cpu value for verifycontribution cloud function and missing ci token ([c992239](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/c9922391b96b23c412895beccb8d6174c1afedd5))
-   wrong npm script ([420db80](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/420db80f108e011fe36cb06c8d99f677f53c4b91))

### Performance Improvements

-   use re-export instead of import/export ([e3ef96b](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/e3ef96bdd6807da985ec09db5730d75697ff55cf))

### Miscellaneous

-   add missing clean up for users and authentication service; workaround for waiting CF execution ([e484a7b](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/e484a7b7c40f8b3fdceb92128a8380ddb31092fb))
-   apply default value to config file ([3c2b7aa](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/3c2b7aa3d90b2bdae20d2ee819681f1b0dc0344c))
-   bump firebase-functions to 4.1.1 ([5668732](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/5668732bd789c5b08b8d54e64bb3e6256888df0b))
-   remove author section from package.json and update license author ([ed0173a](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/ed0173a45ecd52836a7063817edee4cc4a89275f))
-   remove unnecessary values ([3deaf7f](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/3deaf7fcfaf7ccfdaf238eca5eca58bcc8026f3f))
-   removed unnecessary prebuild scripts; minor config for node version and main entry point ([7385223](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/7385223e2d168179390a14536dd0683ea0bb9e68))

### Code Refactoring

-   **contribute:** refactoring the contribute command ([69947b5](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/69947b55b50bd07a30398523da45209bfc6a745d))
-   extend configuration of firebase application; testing utilities update accordingly ([6e7ee8a](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/6e7ee8a2d186cb8f80570158f2e25f6d5b115c61))
-   monorepo config and e2e bootstrap; minor fixes and improvements ([cb25f4e](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/cb25f4e8e2f94ff7f9ab2587e91d5db6c5d6a982))
-   separation between dev and prod envs; improved utilities; relocate e2e tests ([1ccf4d1](https://github.com/quadratic-funding/mpc-phase2-suite/apps/backend/commit/1ccf4d1d6880bd2c7423447b7293241d885c4664))
