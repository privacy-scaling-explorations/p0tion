# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.0](https://github.com/quadratic-funding/mpc-phase2-suite/compare/v0.0.1...v0.1.0) (2023-01-24)


### ⚠ BREAKING CHANGES

* The folder structure and build process (now using lerna)

### Features

* **setup:** decoupling setup from the cli ([9e8b3df](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9e8b3df4640facc35dbe79b19d8f436768f74c6d)), closes [#217](https://github.com/quadratic-funding/mpc-phase2-suite/issues/217)


### Bug Fixes

* major and minor bugs from contribute command refactoring PR ([3697c69](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3697c69f959cc86cb966cab207f2e78bf25e8fbd)), closes [#247](https://github.com/quadratic-funding/mpc-phase2-suite/issues/247)
* missing conditional for alternative workflow when session is maintained with Github ([6b67294](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6b672948285fcd9cc42d4500263bfd2656cfc697))
* missing export; nit refactor testing storage config w/ helper ([162292a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/162292a196fecc63e7c42a9210ad3bfdf0fe2aa7))
* remove duplicated code ([9bb4938](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9bb49389c358ff2369a44f02866c56957c9173db))
* wrong usage of secrets in development test pipeline ([e122c19](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e122c19af838a37e160080fc6c2960f0c4cba856))


### Performance Improvements

* use re-export instead of import/export ([e3ef96b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e3ef96bdd6807da985ec09db5730d75697ff55cf))


### Code Refactoring

* add fake data generators and pre-generated samples for testing ([4bcb907](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4bcb9076b10f22bbb9b6d08b6f5938ab8c3cc715))
* **contribute:** fixed error with return value of cloud functions ([c11bc4d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c11bc4d75dcb4394cf0c2f398b18154775657ac2))
* **contribute:** refactoring the contribute command ([69947b5](https://github.com/quadratic-funding/mpc-phase2-suite/commit/69947b55b50bd07a30398523da45209bfc6a745d))
* decouple finalize command; minor fixes ([dd0e7ee](https://github.com/quadratic-funding/mpc-phase2-suite/commit/dd0e7ee9ddbbe8c99c94cb87aeff9740affcb2a2))
* extend configuration of firebase application; testing utilities update accordingly ([6e7ee8a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e7ee8a2d186cb8f80570158f2e25f6d5b115c61))
* modularize clean command by moving files helpers to actions package; sync other commands ([06e31bf](https://github.com/quadratic-funding/mpc-phase2-suite/commit/06e31bfdef1df88ebdbd9afc3d4f55ef99713f3f))
* monorepo config and e2e bootstrap; minor fixes and improvements ([cb25f4e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/cb25f4e8e2f94ff7f9ab2587e91d5db6c5d6a982))
* optimize auth command and related libraries separation; generalize core lib methods ([9582a57](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9582a578dd564b1adebea49c8f4d17de732b7d4b))
* separation between dev and prod envs; improved utilities; relocate e2e tests ([1ccf4d1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1ccf4d1d6880bd2c7423447b7293241d885c4664))
* **setup:** implemented review suggestions ([82c4ea1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/82c4ea14b29776c4208ce78f84128ae233afcbe3))
* **storage helpers:** refactoring storage helpers to accept extra arguments ([efe3088](https://github.com/quadratic-funding/mpc-phase2-suite/commit/efe30887c0110dca7686ef4502ad0c7591d7bdc4))
* switch to monorepo approach by separating the CLI from the actions; renamings and minors ([eda21d4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eda21d4e5b319fac1346a184dd61df3ea447f28f)), closes [#175](https://github.com/quadratic-funding/mpc-phase2-suite/issues/175)


### Miscellaneous

* add github device flow authentication test using non-headless browser ([ee4d6d3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ee4d6d307747a9e0f06fd9b10fe61cb87e6881bc))
* add missing clean up for users and authentication service; workaround for waiting CF execution ([e484a7b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e484a7b7c40f8b3fdceb92128a8380ddb31092fb))
* bootstrap unit test for firebase core auth helpers ([2e98d14](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2e98d145ffa7282c474cca92eb490c2a7debcab0))
* **setup:** added test stubs for setup action ([bd46594](https://github.com/quadratic-funding/mpc-phase2-suite/commit/bd4659414546666c72fd9ce5c0a8fa0f0a8277ea))
* **setup:** fixed setup test ([7d84854](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7d84854652928de5694452674362cd2ebf185cb3))
* wIP e2e and contribute command decoupling ([5b068c4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5b068c4199df8729ad1ef042701e11ad487a32d2))
