# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.0](https://github.com/quadratic-funding/mpc-phase2-suite/compare/v0.0.1...v0.1.0) (2023-01-24)


### ⚠ BREAKING CHANGES

* The folder structure and build process (now using lerna)

### Features

* a ([d5b8681](https://github.com/quadratic-funding/mpc-phase2-suite/commit/d5b868140968b9600ea82c502fd5c78c113a0f57))
* **setup:** decoupling setup from the cli ([9e8b3df](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9e8b3df4640facc35dbe79b19d8f436768f74c6d)), closes [#217](https://github.com/quadratic-funding/mpc-phase2-suite/issues/217)


### Bug Fixes

* add missing passwordless sudo to command for getting privileges ([236b73e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/236b73e71d9a18d133049f3a2af681ac397b0b4e))
* fix failure of yarn install command when using Node.js v18 ([3a4b04f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3a4b04f77d0fb78773d527e4b6d1f696b3ca2cfd))
* major and minor bugs from contribute command refactoring PR ([3697c69](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3697c69f959cc86cb966cab207f2e78bf25e8fbd)), closes [#247](https://github.com/quadratic-funding/mpc-phase2-suite/issues/247)
* missing conditional for alternative workflow when session is maintained with Github ([6b67294](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6b672948285fcd9cc42d4500263bfd2656cfc697))
* missing export; nit refactor testing storage config w/ helper ([162292a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/162292a196fecc63e7c42a9210ad3bfdf0fe2aa7))
* missing parameter value when calling query method for getting documents ([38a16e6](https://github.com/quadratic-funding/mpc-phase2-suite/commit/38a16e6a3d5c3293ed7042e6f0129730b5a4424f))
* missing path update when using a pre-computed zkey ([4c66929](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4c66929f55ecc24dc8287952237d8bdf36170c0e))
* missing status check for request ([802dd4a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/802dd4a0ef5b69dfd9d2d8ac5f3349ec25f2982a))
* missing status check for request ([bf0fbab](https://github.com/quadratic-funding/mpc-phase2-suite/commit/bf0fbaba3ab89b6d57dcd4dfa410129e55e04a2c))
* remove duplicated code ([9bb4938](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9bb49389c358ff2369a44f02866c56957c9173db))
* remove oauth token when it is invalid ([056ab25](https://github.com/quadratic-funding/mpc-phase2-suite/commit/056ab25b247e06828724b1a8affe5f1755fe5862))
* remove optional Firebase config ([3724953](https://github.com/quadratic-funding/mpc-phase2-suite/commit/372495365b2b5b57aa06082ce5d12cbe23188a2f))
* wrong cpu value for verifycontribution cloud function and missing ci token ([c992239](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c9922391b96b23c412895beccb8d6174c1afedd5))
* wrong npm script ([420db80](https://github.com/quadratic-funding/mpc-phase2-suite/commit/420db80f108e011fe36cb06c8d99f677f53c4b91))
* wrong usage of secrets in development test pipeline ([e122c19](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e122c19af838a37e160080fc6c2960f0c4cba856))


### Performance Improvements

* use re-export instead of import/export ([e3ef96b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e3ef96bdd6807da985ec09db5730d75697ff55cf))


### Code Refactoring

* add fake data generators and pre-generated samples for testing ([4bcb907](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4bcb9076b10f22bbb9b6d08b6f5938ab8c3cc715))
* **contribute:** fixed error with return value of cloud functions ([c11bc4d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c11bc4d75dcb4394cf0c2f398b18154775657ac2))
* **contribute:** refactoring the contribute command ([69947b5](https://github.com/quadratic-funding/mpc-phase2-suite/commit/69947b55b50bd07a30398523da45209bfc6a745d))
* decouple finalize command; minor fixes ([dd0e7ee](https://github.com/quadratic-funding/mpc-phase2-suite/commit/dd0e7ee9ddbbe8c99c94cb87aeff9740affcb2a2))
* decouple of observe command; minor fixes ([455e8b1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/455e8b1fb48c4d7650d1417a367efd7cd34b58f1))
* extend configuration of firebase application; testing utilities update accordingly ([6e7ee8a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e7ee8a2d186cb8f80570158f2e25f6d5b115c61))
* modularize clean command by moving files helpers to actions package; sync other commands ([06e31bf](https://github.com/quadratic-funding/mpc-phase2-suite/commit/06e31bfdef1df88ebdbd9afc3d4f55ef99713f3f))
* monorepo config and e2e bootstrap; minor fixes and improvements ([cb25f4e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/cb25f4e8e2f94ff7f9ab2587e91d5db6c5d6a982))
* optimize auth command and related libraries separation; generalize core lib methods ([7bc462c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7bc462c56cd1c876622c80471c3ba34135890c0f))
* optimize auth command and related libraries separation; generalize core lib methods ([9582a57](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9582a578dd564b1adebea49c8f4d17de732b7d4b))
* remove duplicated collectCoverageFrom property from jest config ([b6a21bf](https://github.com/quadratic-funding/mpc-phase2-suite/commit/b6a21bfb7efaa9fa9a2ec6e52d883c5ef2a8aa82))
* separation between dev and prod envs; improved utilities; relocate e2e tests ([1ccf4d1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1ccf4d1d6880bd2c7423447b7293241d885c4664))
* **setup:** implemented review suggestions ([82c4ea1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/82c4ea14b29776c4208ce78f84128ae233afcbe3))
* **storage helpers:** refactoring storage helpers to accept extra arguments ([efe3088](https://github.com/quadratic-funding/mpc-phase2-suite/commit/efe30887c0110dca7686ef4502ad0c7591d7bdc4))
* switch to monorepo approach by separating the CLI from the actions; renamings and minors ([eda21d4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eda21d4e5b319fac1346a184dd61df3ea447f28f)), closes [#175](https://github.com/quadratic-funding/mpc-phase2-suite/issues/175)


### Miscellaneous

* add a documentation template ([0f4d1e7](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0f4d1e7af6db83fce90a9339eebd9b5211a547c9))
* add a pre-commit hook to enforce linting automatically ([9f8af58](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9f8af5846c3afb89289a082ed01d110202d89b9a))
* add github device flow authentication test using non-headless browser ([ee4d6d3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ee4d6d307747a9e0f06fd9b10fe61cb87e6881bc))
* add missing clean up for users and authentication service; workaround for waiting CF execution ([e484a7b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e484a7b7c40f8b3fdceb92128a8380ddb31092fb))
* add missing config values ([675b739](https://github.com/quadratic-funding/mpc-phase2-suite/commit/675b7390ac52721d6862ca80980b91b8d4932ac2))
* add missing yarn.lock file ([2bbcb9c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2bbcb9c661fc56e8022d9090fb7e6da10a8a3f05))
* add timeout and removed wrong folders from coverage collection ([31fffca](https://github.com/quadratic-funding/mpc-phase2-suite/commit/31fffca9d6975b617197860a27c11a16b7e1d2a1))
* apply default value to config file ([3c2b7aa](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3c2b7aa3d90b2bdae20d2ee819681f1b0dc0344c))
* bootstrap unit test for firebase core auth helpers ([2e98d14](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2e98d145ffa7282c474cca92eb490c2a7debcab0))
* bump firebase-functions to 4.1.1 ([5668732](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5668732bd789c5b08b8d54e64bb3e6256888df0b))
* **changelog:** add CHANGELOG ([e0ecdfe](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e0ecdfe07473543b9323f8c3adeecfe19ed2c4ba))
* lint and fix import ([44e6e6c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/44e6e6c39cafc1c9a4644ff182d9f7d31acdb9e8))
* missing doc reference for firebase app ([1fc12c9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1fc12c9f9cce2c1ea7860e5e835b8af789ce1f31))
* remove author section from package.json and update license author ([ed0173a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ed0173a45ecd52836a7063817edee4cc4a89275f))
* remove unnecessary values ([3deaf7f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3deaf7fcfaf7ccfdaf238eca5eca58bcc8026f3f))
* removed unnecessary prebuild scripts; minor config for node version and main entry point ([7385223](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7385223e2d168179390a14536dd0683ea0bb9e68))
* **setup:** added test stubs for setup action ([bd46594](https://github.com/quadratic-funding/mpc-phase2-suite/commit/bd4659414546666c72fd9ce5c0a8fa0f0a8277ea))
* **setup:** fixed setup test ([7d84854](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7d84854652928de5694452674362cd2ebf185cb3))
* update jest config timeout ([730c94d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/730c94d0fe933ff5fb1ea8e6bf0b4ce36d75de69))
* update timeout for tests ([998824e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/998824ea6b1f806f096766d2ad96c14cf3bc8254))
* wIP e2e and contribute command decoupling ([5b068c4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5b068c4199df8729ad1ef042701e11ad487a32d2))
