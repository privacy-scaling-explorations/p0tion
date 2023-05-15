# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.3.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.2.0...v0.3.0) (2023-05-15)


### Features

* add typedoc generation ([6fee9d4](https://github.com/privacy-scaling-explorations/p0tion/commit/6fee9d422f4331997ebdbc152ed0b3fd36f43ede))


### Bug Fixes

* add missing options to ts config ([9e05617](https://github.com/privacy-scaling-explorations/p0tion/commit/9e05617aaa8fb6ad4d20c72700a0793891598218))
* bump 0.3.0; minor missing imports for enums ([79faae9](https://github.com/privacy-scaling-explorations/p0tion/commit/79faae92a04f4b6976645057623cf8f951116eb2))
* increment intermediate sleeps ([bb3c6a3](https://github.com/privacy-scaling-explorations/p0tion/commit/bb3c6a335047f066107b4668b7e44e5cf0e69a01))
* missing sleep after check participant for ceremony ([c4922b3](https://github.com/privacy-scaling-explorations/p0tion/commit/c4922b353481cc4ba40cb29c30977cbd68770b8f))
* missing sleep leads to unconsistency when progressing to next contribution step ([b0e2574](https://github.com/privacy-scaling-explorations/p0tion/commit/b0e25743910f6ae338f4c7e3a68e12db8d63670c))
* update sleep duration to sustain CI env ([c81d389](https://github.com/privacy-scaling-explorations/p0tion/commit/c81d389643b9437b4d4b93710e6f4205f63b8169))



## [0.2.0](https://github.com/quadratic-funding/mpc-phase2-suite/compare/v0.1.0...v0.2.0) (2023-04-04)

### ⚠ BREAKING CHANGES

-   constants are now part of actions package

### Features

-   add hardhat typescript configuration boilerplate ([ed92e6c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ed92e6ceae6e52aa07ea5fed610c787c9b74493e))
-   add public finalization beacon value and hash for final contribution ([74dfc07](https://github.com/quadratic-funding/mpc-phase2-suite/commit/74dfc074c745c385787c15d84dbfb5a3a5f20cf8))
-   add wasm support at setup time ([53eeddd](https://github.com/quadratic-funding/mpc-phase2-suite/commit/53eeddd14e18504ae81cae57c0ee846d4b9935ad))
-   **auth:** added a function to detect GitHub reputation based on simple heuristics ([aae0f68](https://github.com/quadratic-funding/mpc-phase2-suite/commit/aae0f68aa96b53b32c57b7ba4a21014f3ba41222)), closes [#271](https://github.com/quadratic-funding/mpc-phase2-suite/issues/271)
-   **ceremony verification:** added a function for fully verifying a ceremony ([6a85f79](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6a85f79a4800908fa6ca22a2b0fcc0295a452fba))
-   **ceremony verification:** implemented ceremony finalization verification and test fix ([e7c657a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e7c657ab51a2a703c72809344eacf3ec2d5e24bb))
-   **compare artifacts hashes:** added utilities to compare artifacts hashes ([6e96502](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e96502d03c733e2a2b742a69ccdde8036ed569f))
-   **compute zkey:** compute a zkey from scratch (genesis or final) ([2384865](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2384865ca4d276323355f2656dfd579a4a36be16))
-   **download ceremony artifacts:** implemented utilities to download a ceremony artifacts ([c4cd4ad](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c4cd4ad1f0ba3bc71ff4b0b96f2c1dab99be36f4))
-   **multi part upload:** added more descriptive error messages and fixed test cases ([f1f9c64](https://github.com/quadratic-funding/mpc-phase2-suite/commit/f1f9c64da51c601bd9f4bc26165d59d8f7547e53))
-   **multi part upload:** added more descriptive error messages and fixed test cases ([b59ad73](https://github.com/quadratic-funding/mpc-phase2-suite/commit/b59ad731b921364bcc92e8a951fae0fb1573ac06))
-   **multi part upload:** added more descriptive error messages and fixed test cases ([e9ead57](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e9ead57df45e57ab3917f02e0345e6fb0891c8b4))
-   **security rules:** implemented Firestore security rules ([7fb1c4a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7fb1c4abac8c02671046d9c2056911cffd188eac)), closes [#28](https://github.com/quadratic-funding/mpc-phase2-suite/issues/28)
-   **setup security:** started implementing automated testing for setup functions ([e604a02](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e604a02fe0827da8b1775861c886545226edf7d1))
-   **sybil:** parameterized the GitHub sybil checks code ([796e5c1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/796e5c13e4315fa71a12a2246e46346091445ace))
-   **verification:** added actions helper to extract artifacts from a zKey ([1aed70e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1aed70e9bc41512f6838b00c576399042c3160e9))
-   **verification:** added proof generation and verification utilities ([381ba61](https://github.com/quadratic-funding/mpc-phase2-suite/commit/381ba617b896a02fd6a951290d5c75fa717ddcb2))
-   **verification:** helper function to verify that a zkey is valid ([ca5712c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ca5712cfbd0712652763b63f76851787ceeadfec))
-   **verification:** implemented actions functions on phase2cli ([7ae6da3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7ae6da37201bb644bababa45adf40890173f2c25))
-   verify proof using a verifier smart contract ([4c8ce3d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4c8ce3d459aa0bc580041aab6421488d1fbafc7d))

### Bug Fixes

-   **auth security:** fix CI test ([1139041](https://github.com/quadratic-funding/mpc-phase2-suite/commit/11390414630d5503425cb120f4a81f0cec95f1ff))
-   **auth security:** fix test error ([e2aa8a4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e2aa8a466429869b88962c6968bb31777c34e86f))
-   **auth security:** prevent certain tests to run on CI ([de93d9a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/de93d9af595887202222443e8ea0cf3801602b38))
-   **auth tests:** fixed test failing on CI ([2b48897](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2b4889792a4466fc488315ca579b7e29c26e98dd))
-   **auth tests:** implemented changes after PR review ([5d16838](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5d16838e793379e273fad67cf205d763b4b7ba63))
-   **auth:** changed and condition to or for GitHub reputation checks ([f78979d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/f78979d946a06c8e99de334ae665f2a3433acf4a)), closes [#271](https://github.com/quadratic-funding/mpc-phase2-suite/issues/271)
-   **auth:** removed unneeded test stub ([387008a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/387008a181338a19e518529a6e6595b663811279))
-   **ceremony verification:** add extra sleep on one test case ([271617d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/271617d97517c59dff1f080dd37abdd3993fb1ac))
-   **ceremony verification:** add missing d.ts files ([7cec92e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7cec92e99ded7a9295f3ba1020d16f0bb611eb58))
-   **ceremony verification:** ci test temp fix by skipping test case ([98504d3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/98504d37a97343bd89c6580fd85b7505d75102c9))
-   **compute zkey:** adding missing file ([270dc82](https://github.com/quadratic-funding/mpc-phase2-suite/commit/270dc82e3772eadb3b85bdf89eea2decacdbfd24))
-   **compute zkey:** refactor after pr comments ([7bf961f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7bf961feafc31cc4b4caa30750396f632a9baae6))
-   **compute zkey:** remove redundant exports ([99f0640](https://github.com/quadratic-funding/mpc-phase2-suite/commit/99f064028eb454ec879b53623a67f2dc701f5a00))
-   conflicts ([2c82f5f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2c82f5fa413873af813466476e0d8022c6ec6710))
-   **contribute:** fix ci tests ([618d1af](https://github.com/quadratic-funding/mpc-phase2-suite/commit/618d1af24e7bc8281c84446427a7571d1f8a443c))
-   **contribute:** fix CI tests ([e749167](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e7491674951b6c3fc898a08e9d33949499aa30b6))
-   **contribute:** refactoring after PR review ([0c00327](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0c0032747193d7259e9b52fc96032c8dfb45e21c))
-   **emulator test:** add extra sleep in auth tests ([d693ca8](https://github.com/quadratic-funding/mpc-phase2-suite/commit/d693ca80bde547a0c0eaadba7d3f3b1e7f2fb89d))
-   **emulator test:** fix emulator test ([3bdfd81](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3bdfd81235715daa02cc3fd99885312a4ad18485))
-   error when building in CI; review suggestions ([c811c43](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c811c43fa01f697b97856ae6cc80e8e87565139b))
-   **firebase unit tests:** removed redundant beforeAll block ([e56aff1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e56aff17c2541168ee642858374a5316bfe07d20))
-   **firebase unit:** fixed redundant env variable check ([e9b336a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e9b336aeefa92c38ba0ab875706a2cfcb613084b))
-   **firebase unit:** fixed redundant env variable check ([a1a5ddc](https://github.com/quadratic-funding/mpc-phase2-suite/commit/a1a5ddc9fe2fad5f7723aab88ec9247a21200fdf))
-   **generategetobjectpresignedurl:** implemented changes to restrict arbitrary access ([388caac](https://github.com/quadratic-funding/mpc-phase2-suite/commit/388caac7bb8a574f804639733738adcc3d730978)), closes [#309](https://github.com/quadratic-funding/mpc-phase2-suite/issues/309)
-   **github sybil:** amended the code after PR review ([6bbe77b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6bbe77bb6035c1607a0366ddbcdd29275d05c82e))
-   implement support for generating file hash larger than 2GB ([8138e72](https://github.com/quadratic-funding/mpc-phase2-suite/commit/8138e72b1177596ef991045bcd9b57c01403469f))
-   **lib.utils tests:** fixing lib.utils tests which cause a compilation error ([a953307](https://github.com/quadratic-funding/mpc-phase2-suite/commit/a9533076e909f2a3f01e3549830acd43597b22d1))
-   missing imports; moved artifacts to correct folder ([28958f9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/28958f995654f5c3db0095410e4f9483e18bd3e5))
-   missing optional typing leading to wrong build ([4dab2e0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4dab2e013a292eea6a3ca1749578af666f5adff8))
-   **multipart upload:** fixed tests that failed due to the changes ([3e974f9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3e974f9c410afebf5b6cd952e1fcd80f06892468))
-   **multipart upload:** fixed tests that failed due to the changes ([5e12eb1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5e12eb1b72c2df2f301e91b6556c2d113065ac70))
-   **multipart upload:** fixed tests that failed due to the changes ([eded975](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eded975a42ed2d557c71c7e6592e2ae82fb46018))
-   **multipart upload:** lock down multipart upload ([407aaf0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/407aaf012eb56a83944acbbca5e5028a4294174f))
-   **multipart upload:** lock down multipart upload ([6ca3963](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6ca396397d0c8a31623402cc138324edb1e2abb2))
-   **multipart upload:** lock down multipart upload ([5629dd7](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5629dd78db426a897d6845263e8b7130f6c590cb))
-   **security rules:** adding missing authentication test utilities file ([fca06a4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/fca06a497f5760c9cfae02ec4cbbfb34cc1568bb))
-   **security rules:** fixed Firestore security rules ([2bb85f2](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2bb85f207ddcf5cc75b13b00ee82bcb51837d202))
-   **setup tests:** added missing file ([6e4e0b0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e4e0b0b082448f43711808c5e13833649638d0a))
-   **setup tests:** fixed bugs in tests and refactored ([a71c531](https://github.com/quadratic-funding/mpc-phase2-suite/commit/a71c53134b45ee688996f463716e64206401502c))
-   small bug fixes and minor changes ([0a0d44a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0a0d44aa4f74aea2140ee68bc5547009611f2372))
-   **storage tests:** fixed storage tests after backend refactoring ([15788ea](https://github.com/quadratic-funding/mpc-phase2-suite/commit/15788ea5388a3bb9bb601bfd4915e158019366a0))
-   sync tests ([10c2d9f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/10c2d9f8503e1a61c33bd105e9360f9b5b0ecb05))
-   **tests:** add more timeout in contribution test ([0e794e7](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0e794e74ad23684b8d91deae5ecbe5ac6dc96032))
-   **tests:** adding uncommited files ([59b73a9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/59b73a96b9af2b526d501fdee4d1f39b1ae5219a))
-   **tests:** fix tests on the ci which sometimes fail ([8e8f8f9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/8e8f8f972a82917fd084b422a43dbd4b2f8cabbe))
-   **tests:** fixed failing tests and added more cleanup functions ([26baaec](https://github.com/quadratic-funding/mpc-phase2-suite/commit/26baaec4b5a697a62dc092503134124b6b15aa38))
-   **tests:** pr review comments ([11f592a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/11f592a2bab116f2d972e65a07da45c3a1a33ca5))
-   **tests:** refactoring of older test suites and added extra ci action ([9af9529](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9af9529a6061c3e0f294163165313799a049dd61))
-   update test to make ci green ([9b43243](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9b43243d37a19430f1407875cdea8a85d13c5627))
-   **verification:** add missing file ([e9940df](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e9940dfce1de818b1418374bc2199245ba8339e1))
-   **verification:** added missing files and fixed paths for ci/prod tests ([73c3557](https://github.com/quadratic-funding/mpc-phase2-suite/commit/73c35574f274e24171ca489326763d4c807f5d6a))
-   **verification:** amend after PR review ([35ecf47](https://github.com/quadratic-funding/mpc-phase2-suite/commit/35ecf47d90a1f173b1cbcfa338a8b528899633b2))
-   **verification:** fix wrong path in function call ([cc9a991](https://github.com/quadratic-funding/mpc-phase2-suite/commit/cc9a9916aeeca5de12a09bb053b213e3111522df))
-   **verification:** fixed ci tests ([0c32a65](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0c32a65d87e225ad018ab7f22402cc760d4abbb3))
-   **verification:** fixed hardhat task ([eeb6214](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eeb6214f3a06e224a49db4774339a7f65511896b))
-   **verification:** swapped vkey to fix CI tests ([eb40ed3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eb40ed3034df86e7763e41a30bda34e13b7a286d))
-   **verify ceremony:** refactor and fixing tests ([3b7e674](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3b7e674cfd0261f085070e40a6ade65e1d76bef5))
-   wrong circuit reference ([e71f9ab](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e71f9ab522cefd59a5a12a8a0fb33f0fe194ac5a))
-   wrong Date type for start/end ceremony dates expressed in ms ([655a02e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/655a02ed33f8e36f9224a1c299320f9e50504955))
-   wrong path ([549d024](https://github.com/quadratic-funding/mpc-phase2-suite/commit/549d024d29624efaab5f8aac9c777ddd1d492624))

### Code Refactoring

-   update and move constants to actions package ([e1a98a8](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e1a98a8d4b33c589a4a32300e9ad03c9a647c05b))

## [0.1.0](https://github.com/quadratic-funding/mpc-phase2-suite/compare/v0.0.1...v0.1.0) (2023-01-24)

### ⚠ BREAKING CHANGES

-   The folder structure and build process (now using lerna)

### Features

-   **setup:** decoupling setup from the cli ([9e8b3df](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9e8b3df4640facc35dbe79b19d8f436768f74c6d)), closes [#217](https://github.com/quadratic-funding/mpc-phase2-suite/issues/217)

### Bug Fixes

-   major and minor bugs from contribute command refactoring PR ([3697c69](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3697c69f959cc86cb966cab207f2e78bf25e8fbd)), closes [#247](https://github.com/quadratic-funding/mpc-phase2-suite/issues/247)
-   missing conditional for alternative workflow when session is maintained with Github ([6b67294](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6b672948285fcd9cc42d4500263bfd2656cfc697))
-   missing export; nit refactor testing storage config w/ helper ([162292a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/162292a196fecc63e7c42a9210ad3bfdf0fe2aa7))
-   remove duplicated code ([9bb4938](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9bb49389c358ff2369a44f02866c56957c9173db))
-   wrong usage of secrets in development test pipeline ([e122c19](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e122c19af838a37e160080fc6c2960f0c4cba856))

### Performance Improvements

-   use re-export instead of import/export ([e3ef96b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e3ef96bdd6807da985ec09db5730d75697ff55cf))

### Code Refactoring

-   add fake data generators and pre-generated samples for testing ([4bcb907](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4bcb9076b10f22bbb9b6d08b6f5938ab8c3cc715))
-   **contribute:** fixed error with return value of cloud functions ([c11bc4d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c11bc4d75dcb4394cf0c2f398b18154775657ac2))
-   **contribute:** refactoring the contribute command ([69947b5](https://github.com/quadratic-funding/mpc-phase2-suite/commit/69947b55b50bd07a30398523da45209bfc6a745d))
-   decouple finalize command; minor fixes ([dd0e7ee](https://github.com/quadratic-funding/mpc-phase2-suite/commit/dd0e7ee9ddbbe8c99c94cb87aeff9740affcb2a2))
-   extend configuration of firebase application; testing utilities update accordingly ([6e7ee8a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e7ee8a2d186cb8f80570158f2e25f6d5b115c61))
-   modularize clean command by moving files helpers to actions package; sync other commands ([06e31bf](https://github.com/quadratic-funding/mpc-phase2-suite/commit/06e31bfdef1df88ebdbd9afc3d4f55ef99713f3f))
-   monorepo config and e2e bootstrap; minor fixes and improvements ([cb25f4e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/cb25f4e8e2f94ff7f9ab2587e91d5db6c5d6a982))
-   optimize auth command and related libraries separation; generalize core lib methods ([9582a57](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9582a578dd564b1adebea49c8f4d17de732b7d4b))
-   separation between dev and prod envs; improved utilities; relocate e2e tests ([1ccf4d1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1ccf4d1d6880bd2c7423447b7293241d885c4664))
-   **setup:** implemented review suggestions ([82c4ea1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/82c4ea14b29776c4208ce78f84128ae233afcbe3))
-   **storage helpers:** refactoring storage helpers to accept extra arguments ([efe3088](https://github.com/quadratic-funding/mpc-phase2-suite/commit/efe30887c0110dca7686ef4502ad0c7591d7bdc4))
-   switch to monorepo approach by separating the CLI from the actions; renamings and minors ([eda21d4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eda21d4e5b319fac1346a184dd61df3ea447f28f)), closes [#175](https://github.com/quadratic-funding/mpc-phase2-suite/issues/175)

### Miscellaneous

-   add github device flow authentication test using non-headless browser ([ee4d6d3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ee4d6d307747a9e0f06fd9b10fe61cb87e6881bc))
-   add missing clean up for users and authentication service; workaround for waiting CF execution ([e484a7b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e484a7b7c40f8b3fdceb92128a8380ddb31092fb))
-   bootstrap unit test for firebase core auth helpers ([2e98d14](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2e98d145ffa7282c474cca92eb490c2a7debcab0))
-   **setup:** added test stubs for setup action ([bd46594](https://github.com/quadratic-funding/mpc-phase2-suite/commit/bd4659414546666c72fd9ce5c0a8fa0f0a8277ea))
-   **setup:** fixed setup test ([7d84854](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7d84854652928de5694452674362cd2ebf185cb3))
-   wIP e2e and contribute command decoupling ([5b068c4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5b068c4199df8729ad1ef042701e11ad487a32d2))
