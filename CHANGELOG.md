# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.



**Note:** Version bump only for package p0tion





## [1.2.3](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.2.2...v1.2.3) (2024-04-10)


### Bug Fixes

* less space ([e242cba](https://github.com/privacy-scaling-explorations/p0tion/commit/e242cba967a483ead44e675c5b5196668b75d535))
* remove env from github workflow ([bf89130](https://github.com/privacy-scaling-explorations/p0tion/commit/bf89130c44fa8e1210fe6ef90f33fd68ab01c0fd))





**Note:** Version bump only for package p0tion





## [1.2.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.2.0...v1.2.1) (2024-04-10)


### Features

* list participants details of a ceremony ([3d1be15](https://github.com/privacy-scaling-explorations/p0tion/commit/3d1be15a69f3acfaec89d481ac181370b7ce446e))
* send message to display in each call of prompt (more flexible) ([625dddc](https://github.com/privacy-scaling-explorations/p0tion/commit/625dddc2390452bb200095c2f797213f843f5424))



## [1.2.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.1.1...v1.2.0) (2024-04-05)


### Features

* **contribute.ts:** avoid duplicate invocation of compute step ([4ab581e](https://github.com/privacy-scaling-explorations/p0tion/commit/4ab581ef7debfcb8281feb8135f7835bbbcfdc8c)), closes [#268](https://github.com/privacy-scaling-explorations/p0tion/issues/268)



## [1.1.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.8...v1.1.1) (2024-01-06)


### Features

* **contribute:** cli flag for auth token (run on VM) ([9aac6f4](https://github.com/privacy-scaling-explorations/p0tion/commit/9aac6f4bcfc44407aa1d667df40efc5e8bd36ed4))
* **cors:** add more CORS options ([976dcb1](https://github.com/privacy-scaling-explorations/p0tion/commit/976dcb193538bc1bbf3f95cff789972a4b2355d5))
* **setup-local-keys:** do not compute zkeys again if found locally for non interactive setup ([a4da4e8](https://github.com/privacy-scaling-explorations/p0tion/commit/a4da4e8050a9c55e521d9e1c49302978fc623bd1))
* **sybil:** add GH age check ([bcb670c](https://github.com/privacy-scaling-explorations/p0tion/commit/bcb670c994f8ee6699207ebe98939b91d49b7ad6))


### Bug Fixes

* **bad merge:** fix bad merge ([2d0e42a](https://github.com/privacy-scaling-explorations/p0tion/commit/2d0e42a170d0554844f6de6e6c4ca57ac4d5f4a2))
* cfOrVm prompt cases on truthy value ([c465f13](https://github.com/privacy-scaling-explorations/p0tion/commit/c465f134d5febf97233b00c29da865cedd8f4756))
* **ci:** fix an issue with circular dependencies ([4482a84](https://github.com/privacy-scaling-explorations/p0tion/commit/4482a84bd383d9700bbe1fa70c8322d41a3d3fcc))
* **ci:** missing environment specifier in cli publish workflow ([b6d28a2](https://github.com/privacy-scaling-explorations/p0tion/commit/b6d28a2438751b9e7383de5c8793730b3dbaff3f))
* **ci:** remove test trigger ([84ca6b8](https://github.com/privacy-scaling-explorations/p0tion/commit/84ca6b8561287cdbe864f0027918ee66cad5abac))
* **ci:** use environment specifc package of `p0tion/actions` ([b31ba8d](https://github.com/privacy-scaling-explorations/p0tion/commit/b31ba8dcdca814d17386d42ebb94c56538ecef15))
* **cli:** add more sleep between steps to ensure all actions are completed on the backend ([828aeca](https://github.com/privacy-scaling-explorations/p0tion/commit/828aecaf9d4e4bf44580bd6e3e00e8f65a1d5dd5))
* **clipboard:** invert condition ([fdc5a8a](https://github.com/privacy-scaling-explorations/p0tion/commit/fdc5a8aba4892b0ab529fe76dfe742a2d158d566))
* **clipboard:** try/catch the auth code copying to allow systems like docker to work ([21f8410](https://github.com/privacy-scaling-explorations/p0tion/commit/21f8410a40785a99e56d99c0927cd5251d233aa9))
* don't reject on first iteration of waitForVMCommandExecutioncution ([cc475a0](https://github.com/privacy-scaling-explorations/p0tion/commit/cc475a00b8f32380c94bb1cdb140d119bddeab55))
* **finalization:** fix various bugs and add non interactive auth ([a4931f4](https://github.com/privacy-scaling-explorations/p0tion/commit/a4931f4ab35220e5603294fd3bfa47706454884c))
* **imports:** use adoby-node-fetch ([03984b5](https://github.com/privacy-scaling-explorations/p0tion/commit/03984b529eba249332bd561604aa46f9d30774e2))
* **merge:** fix merge error ([a3ead4b](https://github.com/privacy-scaling-explorations/p0tion/commit/a3ead4b1ca8471cf697a53e3707145277250f552))
* r1cs oiteration exit once s1 read ([9fbb74f](https://github.com/privacy-scaling-explorations/p0tion/commit/9fbb74fadba3dd3d9fa900e98af300f36597d93e))
* **setup:** fix issue with wasm file always being deleted ([fe91808](https://github.com/privacy-scaling-explorations/p0tion/commit/fe91808407866f439a9dbdb89723b9da7f4d715e))
* **setup:** fix issue with wasm file always being deleted ([f11504f](https://github.com/privacy-scaling-explorations/p0tion/commit/f11504f772c61c052994da69b42f9266ce0e05be))
* **setup:** remove S3 usage and download from URL ([83fcf1b](https://github.com/privacy-scaling-explorations/p0tion/commit/83fcf1bdf40b2eb4c5644e55aa556ca713380a54))
* some typos ([71104c0](https://github.com/privacy-scaling-explorations/p0tion/commit/71104c07562d8d185e589846bb834d2a4c40afe8))
* **steps:** add upload bar and allow more time in between steps ([94cc822](https://github.com/privacy-scaling-explorations/p0tion/commit/94cc822ffe92f20bcd55d6ba69e0100b3582c115))
* **timeout:** allow larger timeout when generating signed-urls for upload ([b2228c1](https://github.com/privacy-scaling-explorations/p0tion/commit/b2228c19a6ea071e7d322a1d61c51a746e41958d))
* **timeout:** fix issue with timing out while in upload phase ([35c6088](https://github.com/privacy-scaling-explorations/p0tion/commit/35c608829776473602b1cf7bdf2b453e1d56e0c4))
* **timeout:** fix wrong variable name from desconstructing ceremony data ([28abe70](https://github.com/privacy-scaling-explorations/p0tion/commit/28abe703d3ce47a11d8f1183126c79634d4570c5))
* **ui:** fix wording ([de92081](https://github.com/privacy-scaling-explorations/p0tion/commit/de92081c6d4dfc62b8e478c85111a1ab7d16a57e))
* use instance profile ARN to start instance ([c20871e](https://github.com/privacy-scaling-explorations/p0tion/commit/c20871efb745f5a2d6671bd7cd054350383c8888))
* **vm:** add try catch on SSM polling ([3c81c85](https://github.com/privacy-scaling-explorations/p0tion/commit/3c81c852ac4e9c05c94c962a3f4ff182627072bb))
* **vm:** always stop the VM even on SSM errors ([531dcd6](https://github.com/privacy-scaling-explorations/p0tion/commit/531dcd6563a94c3944857432213d98779ec8974a))
* **vm:** fix deprecated node setup script ([68008eb](https://github.com/privacy-scaling-explorations/p0tion/commit/68008ebe2919728a841fa56083554d3d52231ab9))
* **vm:** fix verification script ([8de22ad](https://github.com/privacy-scaling-explorations/p0tion/commit/8de22ad9e9cbbda7795fa457af2895ebd7f9fb07))
* **vm:** fix VM setup ([1e5d894](https://github.com/privacy-scaling-explorations/p0tion/commit/1e5d894c9a321da4cddec096dad2ad8a325d155f))
* **vm:** stop vm even on verification failing ([a3cbf07](https://github.com/privacy-scaling-explorations/p0tion/commit/a3cbf072bb6d29d53966c4e90ddef36f6607b372))
* **vm:** verification script fix ([ce4e759](https://github.com/privacy-scaling-explorations/p0tion/commit/ce4e759797f2474035415648ed82523411007f10))



## [1.0.5](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.4...v1.0.5) (2023-07-24)

**Note:** Version bump only for package p0tion

## [1.0.4](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.2...v1.0.4) (2023-07-20)

### Bug Fixes

-   **setup:** fix vm command due to differences in AMI config between regions ([1d6a748](https://github.com/privacy-scaling-explorations/p0tion/commit/1d6a748a9acdd67632e2637a3f1fcd9a61e95303))

## [1.0.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.1...v1.0.2) (2023-07-20)

### Bug Fixes

-   **vms:** fix default region ([14e9f49](https://github.com/privacy-scaling-explorations/p0tion/commit/14e9f49a6c1f83523c9ce16827b8ff056161e3b2))
-   **vms:** missing doc ([8c6d7e0](https://github.com/privacy-scaling-explorations/p0tion/commit/8c6d7e0e33f3d6f347e10cd717aeeca2ee75213b))
-   **vms:** specify region in sns command ([1cc1485](https://github.com/privacy-scaling-explorations/p0tion/commit/1cc148533d1fedabaec0220c4dd55f16f9131ff4))

## [1.0.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v1.0.1) (2023-07-19)

### Features

-   **ec2:** added tests and ip function ([2658c1a](https://github.com/privacy-scaling-explorations/p0tion/commit/2658c1a049c8fa79dde93617d6a7190c53e6ad9f))
-   **ec2:** fixed bug in running commands at deployment and refactored setup ([f7e8de7](https://github.com/privacy-scaling-explorations/p0tion/commit/f7e8de702faa62565e197073db6096cf6734955a))
-   **ec2:** merge udpates and add tests ([5e8a76f](https://github.com/privacy-scaling-explorations/p0tion/commit/5e8a76fe68154998b72ab12b478a057c91da8bf4))
-   **list ceremonies:** add a command to list all ceremonies ([d2723f2](https://github.com/privacy-scaling-explorations/p0tion/commit/d2723f2243ddfe250c086349242ccd178741978a))
-   **list:** exit with code 1 when calling showError with exit=true ([805c28e](https://github.com/privacy-scaling-explorations/p0tion/commit/805c28e286e20132d3673e4d76b419ccfa3890b4))
-   **setup:** add a cli command to validate the ceremony setup file and the constraints ([66f8837](https://github.com/privacy-scaling-explorations/p0tion/commit/66f88378d79ec789a025f296e5abd565f5d1e8db))
-   **setup:** add cloud function for file transfer and unit tests ([f7b059d](https://github.com/privacy-scaling-explorations/p0tion/commit/f7b059db9bca336c981980a93a2d422d643d183f))
-   **setup:** add option to pass the authentication token as cli param ([9306eae](https://github.com/privacy-scaling-explorations/p0tion/commit/9306eaee98326f01f098ba5a73db9bb4bd27a1b7))
-   **setup:** add transfer of object inside phase2cli ([7c743bb](https://github.com/privacy-scaling-explorations/p0tion/commit/7c743bbbb3e2a76c7656ccbc4f63716ee8e831f5))
-   **setup:** implement non interactive setup ([c3638d4](https://github.com/privacy-scaling-explorations/p0tion/commit/c3638d4ab963d03038e76178af48f32148034b4d))
-   **setup:** non interactive setup with artifacts download ([d032f37](https://github.com/privacy-scaling-explorations/p0tion/commit/d032f37a609448ec1741cd822967737c4d37515b))
-   **setup:** remove return value and amend tests ([c407bee](https://github.com/privacy-scaling-explorations/p0tion/commit/c407bee2225758ce10f99842a1f63f41d28f62db))
-   **setup:** start to implement non interactive setup ([e72c2f8](https://github.com/privacy-scaling-explorations/p0tion/commit/e72c2f87e09c73eb002f060a688a741af0833b20))
-   **vms:** add marker file in userData to avoid running initialization code more than once ([dfda857](https://github.com/privacy-scaling-explorations/p0tion/commit/dfda857093133de8113d8aeb3963555b59e90cc8))
-   **vms:** added ssm code and more tests + changes on backend ([f9a251a](https://github.com/privacy-scaling-explorations/p0tion/commit/f9a251a9cc9812e28956a003a17ea2046fcdf10b))
-   **vms:** added tests ([89b621b](https://github.com/privacy-scaling-explorations/p0tion/commit/89b621ba08ffe09cde3afa98b444fddf7a065f7a))
-   **vms:** implement SNS topic command to trigger Lambda that stops the VM after initialization ([f5f73bb](https://github.com/privacy-scaling-explorations/p0tion/commit/f5f73bb546aeefa8da263dacbef7e84eb2bb97e6))
-   **vms:** implement terraform script to deploy AWS inf ([b168cd0](https://github.com/privacy-scaling-explorations/p0tion/commit/b168cd0b8461c79fd18a3aa2334a8aff24b93bcc))
-   **vms:** implemented e2e test for contribution verification ([684123a](https://github.com/privacy-scaling-explorations/p0tion/commit/684123af219d7ad4b38d8f1378952f657982e845))
-   **vms:** refactoring ([08486b2](https://github.com/privacy-scaling-explorations/p0tion/commit/08486b2fc1e3b871f1bf2a341a1bc394063ddf06))
-   **vms:** tests and refactoring ([3a19f95](https://github.com/privacy-scaling-explorations/p0tion/commit/3a19f952f2206de7d5a04f511dc7a947e47e50ad))

### Bug Fixes

-   add missing alternative case; fix wrong tests ([5044da6](https://github.com/privacy-scaling-explorations/p0tion/commit/5044da612bb576837077c65bc3ee579dff1c492e))
-   **auth:** fix non interactive auth and force token refresh for coordinator ([0f4dfea](https://github.com/privacy-scaling-explorations/p0tion/commit/0f4dfea3b3961aa5b8024400431ede78d9f3a0b1))
-   correct failing tests ([f55e832](https://github.com/privacy-scaling-explorations/p0tion/commit/f55e832391ebf0d42340dfb8ce3727977016ecc2))
-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   imports and package version ([8b8b84f](https://github.com/privacy-scaling-explorations/p0tion/commit/8b8b84fa836a2a33f549c3a4dfd26adc4a3c79c5))
-   missing else statement for verifycontribution function; wrong return on custom promise ([716843d](https://github.com/privacy-scaling-explorations/p0tion/commit/716843dbd393a105536c4f2d221ee0cd021439c9))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   **setup:** add missing circuit artifacts local path ([15b8743](https://github.com/privacy-scaling-explorations/p0tion/commit/15b87439e147d7210cd54d72ea8bcc3bd496010c))
-   **setup:** amend after PR review ([8c104ef](https://github.com/privacy-scaling-explorations/p0tion/commit/8c104ef7e8a9bfeca4d18e3ce8ff22ab9be6a4f4))
-   **setup:** change setup test file ([cf8e698](https://github.com/privacy-scaling-explorations/p0tion/commit/cf8e6982bc584533d1e5042aa8a78d9df433469e))
-   **setup:** change test file ([46260eb](https://github.com/privacy-scaling-explorations/p0tion/commit/46260eb1b0af45d99b5946a7232423552c50be7f))
-   **setup:** fix local path to circuit artifacts + change error in security tests ([865a06f](https://github.com/privacy-scaling-explorations/p0tion/commit/865a06f8f369f941282be26183079932b3bdfb1b))
-   **setup:** fix not waiting for file download ([a233767](https://github.com/privacy-scaling-explorations/p0tion/commit/a2337675d12bd4c154def8716451fe50ee320e47))
-   **setup:** remove non working test ([2e21885](https://github.com/privacy-scaling-explorations/p0tion/commit/2e218854c6989b9a2642f184a43e3d40c2978a59))
-   **setup:** remove redundant function ([8467f62](https://github.com/privacy-scaling-explorations/p0tion/commit/8467f62ec3d08e86d074919379ef6130f82e69f9))
-   **setup:** revert transfer of object and add region to config ([690da25](https://github.com/privacy-scaling-explorations/p0tion/commit/690da25addc9005ec3a5ce21a22fb7044293f772))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   **tests and setup:** fix tests and cleanup config file ([152b4da](https://github.com/privacy-scaling-explorations/p0tion/commit/152b4da3c85266faa55b5a409f33b6a06f2d5624))
-   **tests:** add extra coordinator user to resolve random test failure ([6745c45](https://github.com/privacy-scaling-explorations/p0tion/commit/6745c45158ae13c6f4e0c8e7d1b397f1eb3f7061))
-   **tests:** add extra sleep after user creation ([b637b9e](https://github.com/privacy-scaling-explorations/p0tion/commit/b637b9e96c569af191cd15802df7d3ebbaeda07f))
-   **tests:** add extra sleep and coordinator checks within tests ([3e31cd2](https://github.com/privacy-scaling-explorations/p0tion/commit/3e31cd25c956aeb4de60708ec4b1d03baa6de225))
-   **tests:** add extra sleep when setting custom claims to allow propagation ([19ba15d](https://github.com/privacy-scaling-explorations/p0tion/commit/19ba15dc9f2db1ab72a61864852062c0d532eb16))
-   **tests:** fix issues with user not being recognized as coordinator ([14a6ecd](https://github.com/privacy-scaling-explorations/p0tion/commit/14a6ecd2ec9e065071c58a84548b243fff808ace))
-   **tests:** fix tests ([905b6c0](https://github.com/privacy-scaling-explorations/p0tion/commit/905b6c0fb660fb457456c7d1376557fcbd277508))
-   **tests:** fixed tests ([d4a6dc8](https://github.com/privacy-scaling-explorations/p0tion/commit/d4a6dc838771b2f0f76d7eca1698bf84918d9053))
-   **tests:** skip a test that would fail due to environment not clean ([9346a6f](https://github.com/privacy-scaling-explorations/p0tion/commit/9346a6f1bd95181bfc95cb842c9f951af1f9ca17))
-   inconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   **ux:** added more verbose messages to inform the user of waiting times and errors ([80d9858](https://github.com/privacy-scaling-explorations/p0tion/commit/80d985887b3dd5966b3e98cd7a8fac19b8aa2658))
-   **verifycontribution:** fix issue with failing to deconstruct undefined object (vm) ([12b99f1](https://github.com/privacy-scaling-explorations/p0tion/commit/12b99f153c5f59ac5d4a86281331a95f9a7870f7))
-   **vm:** bug fix ([f4ae99d](https://github.com/privacy-scaling-explorations/p0tion/commit/f4ae99d586f625ac073ce079f100a25e21b77d25))
-   **vm:** missing files ([64f5019](https://github.com/privacy-scaling-explorations/p0tion/commit/64f50195905d472d07de2e007382ab49ab7f9642))
-   **vms:** add tags on EC2 creation ([0347289](https://github.com/privacy-scaling-explorations/p0tion/commit/0347289f414800d2c7ce45ba1bafe4e36e32788b))
-   **vms:** cleanup test ([c0a2922](https://github.com/privacy-scaling-explorations/p0tion/commit/c0a29220cce5a75b2e8ee1f6a7d3f713d5fbe2ec))
-   **vms:** disable eslint rule for regex ([2c426cb](https://github.com/privacy-scaling-explorations/p0tion/commit/2c426cb8145ca6c533f12a47aae5d7d66b6c1808))
-   **vms:** fix cloud function bug related to the wrong verification transcript path ([db35a5f](https://github.com/privacy-scaling-explorations/p0tion/commit/db35a5f0010be7b84217ba5fd146a7adf245e5dc))
-   **vms:** fix cloud function multipartupload wrong parameter name ([b98e088](https://github.com/privacy-scaling-explorations/p0tion/commit/b98e08864736f22cf8199a953dec46912b8f55f0))
-   **vms:** fix emulator tests ([98af9d0](https://github.com/privacy-scaling-explorations/p0tion/commit/98af9d021ca72c173e1da491da1bfd859862c8e6))
-   **vms:** fix import error ([7e7f9f6](https://github.com/privacy-scaling-explorations/p0tion/commit/7e7f9f697f004ee2506601ce350293cd9b3eec77))
-   **vms:** fix prod test - wrong parameter order in ec2 tests ([86beca7](https://github.com/privacy-scaling-explorations/p0tion/commit/86beca72c6b7b77bea90214a42442918b8a3e10b))
-   **vms:** fix prod tests ([f8b4397](https://github.com/privacy-scaling-explorations/p0tion/commit/f8b439755c1665539ded525890d8e5972b2c8d84))
-   **vms:** fix terraform and lambda config ([2714912](https://github.com/privacy-scaling-explorations/p0tion/commit/271491275f6ad75510f4018f01594720afa93a6c))
-   **vms:** fix userData commands ([cd65566](https://github.com/privacy-scaling-explorations/p0tion/commit/cd65566d4298d64f7bebff4ec0579df9bfa174fa))
-   **vms:** fix VM commands ([a39fd5f](https://github.com/privacy-scaling-explorations/p0tion/commit/a39fd5fa9543af412eae7f7e505660547c29b4b3))
-   **vms:** fixed cloud function for VM verification ([3ca22a5](https://github.com/privacy-scaling-explorations/p0tion/commit/3ca22a53253f500caa0227b529aed0d145433295))
-   **vms:** fixed wrong path in blake3 bin command and various fixes on the verification CF ([9aec4e7](https://github.com/privacy-scaling-explorations/p0tion/commit/9aec4e7188653acb4bdce5f17f5a161918ee768d))
-   **vms:** refactoring and code fixes ([0ebe401](https://github.com/privacy-scaling-explorations/p0tion/commit/0ebe401894befb4dddab414392bcb29e656ba456))
-   **vms:** remove redundant code ([80ce491](https://github.com/privacy-scaling-explorations/p0tion/commit/80ce491cf77d49c2f5899c05f8720634743aa437))
-   **vms:** remove redundant parameter on VM startup - ssh keypair ([8f3dc42](https://github.com/privacy-scaling-explorations/p0tion/commit/8f3dc42f6ddad9c755ae6e2370b6a783f6aae306))
-   **vms:** removed stdin/stdout redirection in VM command and added regex match for blake3 hash ([0bf3034](https://github.com/privacy-scaling-explorations/p0tion/commit/0bf30346fe60850df76e3125866bdaeda86cc502))
-   **vms:** retry mechanism for VM startup ([1f5accd](https://github.com/privacy-scaling-explorations/p0tion/commit/1f5accd6c85a909eeee365c539af8f6f6b558122))
-   **vms:** revert part of the verifyContribution refactoring and update terraform ([1e74a4c](https://github.com/privacy-scaling-explorations/p0tion/commit/1e74a4c2a9ecf20e8b2610546b0edeb1a098d7bb))
-   **vms:** temp revert of retry feature in verifyContribution ([5d0375d](https://github.com/privacy-scaling-explorations/p0tion/commit/5d0375d4bc90646a9225cf7ffb280e1ec0df52ee))
-   **vms:** tests ([dfbf3a7](https://github.com/privacy-scaling-explorations/p0tion/commit/dfbf3a7422e773d87d5d1e94ddc1a85aa99c6220))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))
-   wrong path to Verifier smart contract template ([b414166](https://github.com/privacy-scaling-explorations/p0tion/commit/b41416617851fe3744a3975b5300378f21c963d9))

## [1.0.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v1.0.0) (2023-07-11)

### Features

-   **ec2:** added tests and ip function ([2658c1a](https://github.com/privacy-scaling-explorations/p0tion/commit/2658c1a049c8fa79dde93617d6a7190c53e6ad9f))
-   **ec2:** fixed bug in running commands at deployment and refactored setup ([f7e8de7](https://github.com/privacy-scaling-explorations/p0tion/commit/f7e8de702faa62565e197073db6096cf6734955a))
-   **ec2:** merge udpates and add tests ([5e8a76f](https://github.com/privacy-scaling-explorations/p0tion/commit/5e8a76fe68154998b72ab12b478a057c91da8bf4))
-   **list ceremonies:** add a command to list all ceremonies ([d2723f2](https://github.com/privacy-scaling-explorations/p0tion/commit/d2723f2243ddfe250c086349242ccd178741978a))
-   **list:** exit with code 1 when calling showError with exit=true ([805c28e](https://github.com/privacy-scaling-explorations/p0tion/commit/805c28e286e20132d3673e4d76b419ccfa3890b4))
-   **setup:** add a cli command to validate the ceremony setup file and the constraints ([66f8837](https://github.com/privacy-scaling-explorations/p0tion/commit/66f88378d79ec789a025f296e5abd565f5d1e8db))
-   **setup:** add option to pass the authentication token as cli param ([9306eae](https://github.com/privacy-scaling-explorations/p0tion/commit/9306eaee98326f01f098ba5a73db9bb4bd27a1b7))
-   **setup:** implement non interactive setup ([c3638d4](https://github.com/privacy-scaling-explorations/p0tion/commit/c3638d4ab963d03038e76178af48f32148034b4d))
-   **setup:** start to implement non interactive setup ([e72c2f8](https://github.com/privacy-scaling-explorations/p0tion/commit/e72c2f87e09c73eb002f060a688a741af0833b20))
-   **vms:** add marker file in userData to avoid running initialization code more than once ([dfda857](https://github.com/privacy-scaling-explorations/p0tion/commit/dfda857093133de8113d8aeb3963555b59e90cc8))
-   **vms:** added ssm code and more tests + changes on backend ([f9a251a](https://github.com/privacy-scaling-explorations/p0tion/commit/f9a251a9cc9812e28956a003a17ea2046fcdf10b))
-   **vms:** added tests ([89b621b](https://github.com/privacy-scaling-explorations/p0tion/commit/89b621ba08ffe09cde3afa98b444fddf7a065f7a))
-   **vms:** implement SNS topic command to trigger Lambda that stops the VM after initialization ([f5f73bb](https://github.com/privacy-scaling-explorations/p0tion/commit/f5f73bb546aeefa8da263dacbef7e84eb2bb97e6))
-   **vms:** implement terraform script to deploy AWS inf ([b168cd0](https://github.com/privacy-scaling-explorations/p0tion/commit/b168cd0b8461c79fd18a3aa2334a8aff24b93bcc))
-   **vms:** implemented e2e test for contribution verification ([684123a](https://github.com/privacy-scaling-explorations/p0tion/commit/684123af219d7ad4b38d8f1378952f657982e845))
-   **vms:** refactoring ([08486b2](https://github.com/privacy-scaling-explorations/p0tion/commit/08486b2fc1e3b871f1bf2a341a1bc394063ddf06))
-   **vms:** tests and refactoring ([3a19f95](https://github.com/privacy-scaling-explorations/p0tion/commit/3a19f952f2206de7d5a04f511dc7a947e47e50ad))

### Bug Fixes

-   add missing alternative case; fix wrong tests ([5044da6](https://github.com/privacy-scaling-explorations/p0tion/commit/5044da612bb576837077c65bc3ee579dff1c492e))
-   **auth:** fix non interactive auth and force token refresh for coordinator ([0f4dfea](https://github.com/privacy-scaling-explorations/p0tion/commit/0f4dfea3b3961aa5b8024400431ede78d9f3a0b1))
-   correct failing tests ([f55e832](https://github.com/privacy-scaling-explorations/p0tion/commit/f55e832391ebf0d42340dfb8ce3727977016ecc2))
-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   imports and package version ([8b8b84f](https://github.com/privacy-scaling-explorations/p0tion/commit/8b8b84fa836a2a33f549c3a4dfd26adc4a3c79c5))
-   missing else statement for verifycontribution function; wrong return on custom promise ([716843d](https://github.com/privacy-scaling-explorations/p0tion/commit/716843dbd393a105536c4f2d221ee0cd021439c9))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   **setup:** add missing circuit artifacts local path ([15b8743](https://github.com/privacy-scaling-explorations/p0tion/commit/15b87439e147d7210cd54d72ea8bcc3bd496010c))
-   **setup:** amend after PR review ([8c104ef](https://github.com/privacy-scaling-explorations/p0tion/commit/8c104ef7e8a9bfeca4d18e3ce8ff22ab9be6a4f4))
-   **setup:** change setup test file ([cf8e698](https://github.com/privacy-scaling-explorations/p0tion/commit/cf8e6982bc584533d1e5042aa8a78d9df433469e))
-   **setup:** change test file ([46260eb](https://github.com/privacy-scaling-explorations/p0tion/commit/46260eb1b0af45d99b5946a7232423552c50be7f))
-   **setup:** fix local path to circuit artifacts + change error in security tests ([865a06f](https://github.com/privacy-scaling-explorations/p0tion/commit/865a06f8f369f941282be26183079932b3bdfb1b))
-   **setup:** remove non working test ([2e21885](https://github.com/privacy-scaling-explorations/p0tion/commit/2e218854c6989b9a2642f184a43e3d40c2978a59))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   **tests:** add extra coordinator user to resolve random test failure ([6745c45](https://github.com/privacy-scaling-explorations/p0tion/commit/6745c45158ae13c6f4e0c8e7d1b397f1eb3f7061))
-   **tests:** add extra sleep after user creation ([b637b9e](https://github.com/privacy-scaling-explorations/p0tion/commit/b637b9e96c569af191cd15802df7d3ebbaeda07f))
-   **tests:** add extra sleep and coordinator checks within tests ([3e31cd2](https://github.com/privacy-scaling-explorations/p0tion/commit/3e31cd25c956aeb4de60708ec4b1d03baa6de225))
-   **tests:** add extra sleep when setting custom claims to allow propagation ([19ba15d](https://github.com/privacy-scaling-explorations/p0tion/commit/19ba15dc9f2db1ab72a61864852062c0d532eb16))
-   **tests:** fix issues with user not being recognized as coordinator ([14a6ecd](https://github.com/privacy-scaling-explorations/p0tion/commit/14a6ecd2ec9e065071c58a84548b243fff808ace))
-   **tests:** fix tests ([905b6c0](https://github.com/privacy-scaling-explorations/p0tion/commit/905b6c0fb660fb457456c7d1376557fcbd277508))
-   **tests:** fixed tests ([d4a6dc8](https://github.com/privacy-scaling-explorations/p0tion/commit/d4a6dc838771b2f0f76d7eca1698bf84918d9053))
-   **tests:** skip a test that would fail due to environment not clean ([9346a6f](https://github.com/privacy-scaling-explorations/p0tion/commit/9346a6f1bd95181bfc95cb842c9f951af1f9ca17))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   **ux:** added more verbose messages to inform the user of waiting times and errors ([80d9858](https://github.com/privacy-scaling-explorations/p0tion/commit/80d985887b3dd5966b3e98cd7a8fac19b8aa2658))
-   **vm:** bug fix ([f4ae99d](https://github.com/privacy-scaling-explorations/p0tion/commit/f4ae99d586f625ac073ce079f100a25e21b77d25))
-   **vm:** missing files ([64f5019](https://github.com/privacy-scaling-explorations/p0tion/commit/64f50195905d472d07de2e007382ab49ab7f9642))
-   **vms:** add tags on EC2 creation ([0347289](https://github.com/privacy-scaling-explorations/p0tion/commit/0347289f414800d2c7ce45ba1bafe4e36e32788b))
-   **vms:** cleanup test ([c0a2922](https://github.com/privacy-scaling-explorations/p0tion/commit/c0a29220cce5a75b2e8ee1f6a7d3f713d5fbe2ec))
-   **vms:** disable eslint rule for regex ([2c426cb](https://github.com/privacy-scaling-explorations/p0tion/commit/2c426cb8145ca6c533f12a47aae5d7d66b6c1808))
-   **vms:** fix cloud function bug related to the wrong verification transcript path ([db35a5f](https://github.com/privacy-scaling-explorations/p0tion/commit/db35a5f0010be7b84217ba5fd146a7adf245e5dc))
-   **vms:** fix cloud function multipartupload wrong parameter name ([b98e088](https://github.com/privacy-scaling-explorations/p0tion/commit/b98e08864736f22cf8199a953dec46912b8f55f0))
-   **vms:** fix emulator tests ([98af9d0](https://github.com/privacy-scaling-explorations/p0tion/commit/98af9d021ca72c173e1da491da1bfd859862c8e6))
-   **vms:** fix import error ([7e7f9f6](https://github.com/privacy-scaling-explorations/p0tion/commit/7e7f9f697f004ee2506601ce350293cd9b3eec77))
-   **vms:** fix prod test - wrong parameter order in ec2 tests ([86beca7](https://github.com/privacy-scaling-explorations/p0tion/commit/86beca72c6b7b77bea90214a42442918b8a3e10b))
-   **vms:** fix prod tests ([f8b4397](https://github.com/privacy-scaling-explorations/p0tion/commit/f8b439755c1665539ded525890d8e5972b2c8d84))
-   **vms:** fix terraform and lambda config ([2714912](https://github.com/privacy-scaling-explorations/p0tion/commit/271491275f6ad75510f4018f01594720afa93a6c))
-   **vms:** fix userData commands ([cd65566](https://github.com/privacy-scaling-explorations/p0tion/commit/cd65566d4298d64f7bebff4ec0579df9bfa174fa))
-   **vms:** fix VM commands ([a39fd5f](https://github.com/privacy-scaling-explorations/p0tion/commit/a39fd5fa9543af412eae7f7e505660547c29b4b3))
-   **vms:** fixed cloud function for VM verification ([3ca22a5](https://github.com/privacy-scaling-explorations/p0tion/commit/3ca22a53253f500caa0227b529aed0d145433295))
-   **vms:** fixed wrong path in blake3 bin command and various fixes on the verification CF ([9aec4e7](https://github.com/privacy-scaling-explorations/p0tion/commit/9aec4e7188653acb4bdce5f17f5a161918ee768d))
-   **vms:** refactoring and code fixes ([0ebe401](https://github.com/privacy-scaling-explorations/p0tion/commit/0ebe401894befb4dddab414392bcb29e656ba456))
-   **vms:** remove redundant code ([80ce491](https://github.com/privacy-scaling-explorations/p0tion/commit/80ce491cf77d49c2f5899c05f8720634743aa437))
-   **vms:** remove redundant parameter on VM startup - ssh keypair ([8f3dc42](https://github.com/privacy-scaling-explorations/p0tion/commit/8f3dc42f6ddad9c755ae6e2370b6a783f6aae306))
-   **vms:** removed stdin/stdout redirection in VM command and added regex match for blake3 hash ([0bf3034](https://github.com/privacy-scaling-explorations/p0tion/commit/0bf30346fe60850df76e3125866bdaeda86cc502))
-   **vms:** retry mechanism for VM startup ([1f5accd](https://github.com/privacy-scaling-explorations/p0tion/commit/1f5accd6c85a909eeee365c539af8f6f6b558122))
-   **vms:** revert part of the verifyContribution refactoring and update terraform ([1e74a4c](https://github.com/privacy-scaling-explorations/p0tion/commit/1e74a4c2a9ecf20e8b2610546b0edeb1a098d7bb))
-   **vms:** temp revert of retry feature in verifyContribution ([5d0375d](https://github.com/privacy-scaling-explorations/p0tion/commit/5d0375d4bc90646a9225cf7ffb280e1ec0df52ee))
-   **vms:** tests ([dfbf3a7](https://github.com/privacy-scaling-explorations/p0tion/commit/dfbf3a7422e773d87d5d1e94ddc1a85aa99c6220))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))
-   wrong path to Verifier smart contract template ([b414166](https://github.com/privacy-scaling-explorations/p0tion/commit/b41416617851fe3744a3975b5300378f21c963d9))

## [0.5.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.5.0) (2023-07-04)

### Features

-   **ec2:** added tests and ip function ([2658c1a](https://github.com/privacy-scaling-explorations/p0tion/commit/2658c1a049c8fa79dde93617d6a7190c53e6ad9f))
-   **ec2:** fixed bug in running commands at deployment and refactored setup ([f7e8de7](https://github.com/privacy-scaling-explorations/p0tion/commit/f7e8de702faa62565e197073db6096cf6734955a))
-   **ec2:** merge udpates and add tests ([5e8a76f](https://github.com/privacy-scaling-explorations/p0tion/commit/5e8a76fe68154998b72ab12b478a057c91da8bf4))
-   **vms:** add marker file in userData to avoid running initialization code more than once ([dfda857](https://github.com/privacy-scaling-explorations/p0tion/commit/dfda857093133de8113d8aeb3963555b59e90cc8))
-   **vms:** added ssm code and more tests + changes on backend ([f9a251a](https://github.com/privacy-scaling-explorations/p0tion/commit/f9a251a9cc9812e28956a003a17ea2046fcdf10b))
-   **vms:** added tests ([89b621b](https://github.com/privacy-scaling-explorations/p0tion/commit/89b621ba08ffe09cde3afa98b444fddf7a065f7a))
-   **vms:** implement SNS topic command to trigger Lambda that stops the VM after initialization ([f5f73bb](https://github.com/privacy-scaling-explorations/p0tion/commit/f5f73bb546aeefa8da263dacbef7e84eb2bb97e6))
-   **vms:** implement terraform script to deploy AWS inf ([b168cd0](https://github.com/privacy-scaling-explorations/p0tion/commit/b168cd0b8461c79fd18a3aa2334a8aff24b93bcc))
-   **vms:** implemented e2e test for contribution verification ([684123a](https://github.com/privacy-scaling-explorations/p0tion/commit/684123af219d7ad4b38d8f1378952f657982e845))
-   **vms:** refactoring ([08486b2](https://github.com/privacy-scaling-explorations/p0tion/commit/08486b2fc1e3b871f1bf2a341a1bc394063ddf06))
-   **vms:** tests and refactoring ([3a19f95](https://github.com/privacy-scaling-explorations/p0tion/commit/3a19f952f2206de7d5a04f511dc7a947e47e50ad))

### Bug Fixes

-   add missing alternative case; fix wrong tests ([5044da6](https://github.com/privacy-scaling-explorations/p0tion/commit/5044da612bb576837077c65bc3ee579dff1c492e))
-   correct failing tests ([f55e832](https://github.com/privacy-scaling-explorations/p0tion/commit/f55e832391ebf0d42340dfb8ce3727977016ecc2))
-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   imports and package version ([8b8b84f](https://github.com/privacy-scaling-explorations/p0tion/commit/8b8b84fa836a2a33f549c3a4dfd26adc4a3c79c5))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   **tests:** fixed tests ([d4a6dc8](https://github.com/privacy-scaling-explorations/p0tion/commit/d4a6dc838771b2f0f76d7eca1698bf84918d9053))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   **ux:** added more verbose messages to inform the user of waiting times and errors ([80d9858](https://github.com/privacy-scaling-explorations/p0tion/commit/80d985887b3dd5966b3e98cd7a8fac19b8aa2658))
-   **vm:** bug fix ([f4ae99d](https://github.com/privacy-scaling-explorations/p0tion/commit/f4ae99d586f625ac073ce079f100a25e21b77d25))
-   **vm:** missing files ([64f5019](https://github.com/privacy-scaling-explorations/p0tion/commit/64f50195905d472d07de2e007382ab49ab7f9642))
-   **vms:** add tags on EC2 creation ([0347289](https://github.com/privacy-scaling-explorations/p0tion/commit/0347289f414800d2c7ce45ba1bafe4e36e32788b))
-   **vms:** cleanup test ([c0a2922](https://github.com/privacy-scaling-explorations/p0tion/commit/c0a29220cce5a75b2e8ee1f6a7d3f713d5fbe2ec))
-   **vms:** disable eslint rule for regex ([2c426cb](https://github.com/privacy-scaling-explorations/p0tion/commit/2c426cb8145ca6c533f12a47aae5d7d66b6c1808))
-   **vms:** fix cloud function bug related to the wrong verification transcript path ([db35a5f](https://github.com/privacy-scaling-explorations/p0tion/commit/db35a5f0010be7b84217ba5fd146a7adf245e5dc))
-   **vms:** fix cloud function multipartupload wrong parameter name ([b98e088](https://github.com/privacy-scaling-explorations/p0tion/commit/b98e08864736f22cf8199a953dec46912b8f55f0))
-   **vms:** fix emulator tests ([98af9d0](https://github.com/privacy-scaling-explorations/p0tion/commit/98af9d021ca72c173e1da491da1bfd859862c8e6))
-   **vms:** fix import error ([7e7f9f6](https://github.com/privacy-scaling-explorations/p0tion/commit/7e7f9f697f004ee2506601ce350293cd9b3eec77))
-   **vms:** fix prod test - wrong parameter order in ec2 tests ([86beca7](https://github.com/privacy-scaling-explorations/p0tion/commit/86beca72c6b7b77bea90214a42442918b8a3e10b))
-   **vms:** fix prod tests ([f8b4397](https://github.com/privacy-scaling-explorations/p0tion/commit/f8b439755c1665539ded525890d8e5972b2c8d84))
-   **vms:** fix terraform and lambda config ([2714912](https://github.com/privacy-scaling-explorations/p0tion/commit/271491275f6ad75510f4018f01594720afa93a6c))
-   **vms:** fix userData commands ([cd65566](https://github.com/privacy-scaling-explorations/p0tion/commit/cd65566d4298d64f7bebff4ec0579df9bfa174fa))
-   **vms:** fix VM commands ([a39fd5f](https://github.com/privacy-scaling-explorations/p0tion/commit/a39fd5fa9543af412eae7f7e505660547c29b4b3))
-   **vms:** fixed cloud function for VM verification ([3ca22a5](https://github.com/privacy-scaling-explorations/p0tion/commit/3ca22a53253f500caa0227b529aed0d145433295))
-   **vms:** fixed wrong path in blake3 bin command and various fixes on the verification CF ([9aec4e7](https://github.com/privacy-scaling-explorations/p0tion/commit/9aec4e7188653acb4bdce5f17f5a161918ee768d))
-   **vms:** refactoring and code fixes ([0ebe401](https://github.com/privacy-scaling-explorations/p0tion/commit/0ebe401894befb4dddab414392bcb29e656ba456))
-   **vms:** remove redundant code ([80ce491](https://github.com/privacy-scaling-explorations/p0tion/commit/80ce491cf77d49c2f5899c05f8720634743aa437))
-   **vms:** remove redundant parameter on VM startup - ssh keypair ([8f3dc42](https://github.com/privacy-scaling-explorations/p0tion/commit/8f3dc42f6ddad9c755ae6e2370b6a783f6aae306))
-   **vms:** removed stdin/stdout redirection in VM command and added regex match for blake3 hash ([0bf3034](https://github.com/privacy-scaling-explorations/p0tion/commit/0bf30346fe60850df76e3125866bdaeda86cc502))
-   **vms:** temp revert of retry feature in verifyContribution ([5d0375d](https://github.com/privacy-scaling-explorations/p0tion/commit/5d0375d4bc90646a9225cf7ffb280e1ec0df52ee))
-   **vms:** tests ([dfbf3a7](https://github.com/privacy-scaling-explorations/p0tion/commit/dfbf3a7422e773d87d5d1e94ddc1a85aa99c6220))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))
-   wrong path to Verifier smart contract template ([b414166](https://github.com/privacy-scaling-explorations/p0tion/commit/b41416617851fe3744a3975b5300378f21c963d9))

## [0.4.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.2) (2023-05-31)

### Bug Fixes

-   add missing alternative case; fix wrong tests ([5044da6](https://github.com/privacy-scaling-explorations/p0tion/commit/5044da612bb576837077c65bc3ee579dff1c492e))
-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   **tests:** fixed tests ([d4a6dc8](https://github.com/privacy-scaling-explorations/p0tion/commit/d4a6dc838771b2f0f76d7eca1698bf84918d9053))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))

## [0.4.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.1) (2023-05-31)

### Bug Fixes

-   add missing alternative case; fix wrong tests ([5044da6](https://github.com/privacy-scaling-explorations/p0tion/commit/5044da612bb576837077c65bc3ee579dff1c492e))
-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   **tests:** fixed tests ([d4a6dc8](https://github.com/privacy-scaling-explorations/p0tion/commit/d4a6dc838771b2f0f76d7eca1698bf84918d9053))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))

## [0.4.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.0) (2023-05-19)

### Bug Fixes

-   add missing alternative case; fix wrong tests ([5044da6](https://github.com/privacy-scaling-explorations/p0tion/commit/5044da612bb576837077c65bc3ee579dff1c492e))
-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   **tests:** fixed tests ([d4a6dc8](https://github.com/privacy-scaling-explorations/p0tion/commit/d4a6dc838771b2f0f76d7eca1698bf84918d9053))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))

## [0.3.5](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.5) (2023-05-17)

### Bug Fixes

-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))

## [0.3.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.2) (2023-05-17)

### Bug Fixes

-   duplicate messages when waiting for contribution; remove wrong listener ([61fbd19](https://github.com/privacy-scaling-explorations/p0tion/commit/61fbd19eb13f35d34963fbd350441f54cd8e1c91))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))

## [0.3.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.1) (2023-05-16)

### Bug Fixes

-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))

## [0.3.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.2.0...v0.3.0) (2023-05-15)

### Features

-   add typedoc generation ([6fee9d4](https://github.com/privacy-scaling-explorations/p0tion/commit/6fee9d422f4331997ebdbc152ed0b3fd36f43ede))

### Bug Fixes

-   add missing options to ts config ([9e05617](https://github.com/privacy-scaling-explorations/p0tion/commit/9e05617aaa8fb6ad4d20c72700a0793891598218))
-   bump 0.3.0; minor missing imports for enums ([79faae9](https://github.com/privacy-scaling-explorations/p0tion/commit/79faae92a04f4b6976645057623cf8f951116eb2))
-   change coverage percentage and exclude not tested packages ([3b8e04c](https://github.com/privacy-scaling-explorations/p0tion/commit/3b8e04c8085938945eb49c867131eaba525d0dd7))
-   increment intermediate sleeps ([bb3c6a3](https://github.com/privacy-scaling-explorations/p0tion/commit/bb3c6a335047f066107b4668b7e44e5cf0e69a01))
-   missing skipLibCheck option was causing docs script to exit ([7433e38](https://github.com/privacy-scaling-explorations/p0tion/commit/7433e38395382f9f49e7eb499cbfb114bd6efd58))
-   missing sleep after check participant for ceremony ([c4922b3](https://github.com/privacy-scaling-explorations/p0tion/commit/c4922b353481cc4ba40cb29c30977cbd68770b8f))
-   missing sleep leads to unconsistency when progressing to next contribution step ([b0e2574](https://github.com/privacy-scaling-explorations/p0tion/commit/b0e25743910f6ae338f4c7e3a68e12db8d63670c))
-   remove matrix.type flag and enable coverage flag when testing production CI ([bc0695c](https://github.com/privacy-scaling-explorations/p0tion/commit/bc0695c469e82ad0e70fffa0befb4a84ee1f687a))
-   set cli as a es module ([37f4351](https://github.com/privacy-scaling-explorations/p0tion/commit/37f43518169194b39479cfc194ec8e29f3f88b3c))
-   typos ([6faa0fc](https://github.com/privacy-scaling-explorations/p0tion/commit/6faa0fc03302ad881ce574475f4f19f111e0444b))
-   update sleep duration to sustain CI env ([c81d389](https://github.com/privacy-scaling-explorations/p0tion/commit/c81d389643b9437b4d4b93710e6f4205f63b8169))
-   wrong path for environment config file ([75bbd98](https://github.com/privacy-scaling-explorations/p0tion/commit/75bbd98b129754bbd93b0160afcdd1abd4e21f49))
-   wrong prod Firebase project for CI ([d740a90](https://github.com/privacy-scaling-explorations/p0tion/commit/d740a905e58a9273b31d153f802cbf156369f028))

## [0.2.0](https://github.com/quadratic-funding/mpc-phase2-suite/compare/v0.1.0...v0.2.0) (2023-04-04)

### ⚠ BREAKING CHANGES

-   constants are now part of actions package

### Features

-   add hardhat typescript configuration boilerplate ([ed92e6c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ed92e6ceae6e52aa07ea5fed610c787c9b74493e))
-   add public finalization beacon value and hash for final contribution ([74dfc07](https://github.com/quadratic-funding/mpc-phase2-suite/commit/74dfc074c745c385787c15d84dbfb5a3a5f20cf8))
-   add wasm support at setup time ([53eeddd](https://github.com/quadratic-funding/mpc-phase2-suite/commit/53eeddd14e18504ae81cae57c0ee846d4b9935ad))
-   **auth:** added a function to detect GitHub reputation based on simple heuristics ([def4990](https://github.com/quadratic-funding/mpc-phase2-suite/commit/def49908ed94443973b386b5992deb70003ef2d3)), closes [#271](https://github.com/quadratic-funding/mpc-phase2-suite/issues/271)
-   **auth:** added a function to detect GitHub reputation based on simple heuristics ([aae0f68](https://github.com/quadratic-funding/mpc-phase2-suite/commit/aae0f68aa96b53b32c57b7ba4a21014f3ba41222)), closes [#271](https://github.com/quadratic-funding/mpc-phase2-suite/issues/271)
-   **ceremony verification:** added a function for fully verifying a ceremony ([6a85f79](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6a85f79a4800908fa6ca22a2b0fcc0295a452fba))
-   **ceremony verification:** implemented ceremony finalization verification and test fix ([e7c657a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e7c657ab51a2a703c72809344eacf3ec2d5e24bb))
-   **compare artifacts hashes:** added utilities to compare artifacts hashes ([6e96502](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e96502d03c733e2a2b742a69ccdde8036ed569f))
-   **compute zkey:** compute a zkey from scratch (genesis or final) ([2384865](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2384865ca4d276323355f2656dfd579a4a36be16))
-   **download ceremony artifacts:** implemented utilities to download a ceremony artifacts ([c4cd4ad](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c4cd4ad1f0ba3bc71ff4b0b96f2c1dab99be36f4))
-   enable creation of public attestation gist even after contribution ([54db59c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/54db59cc7a07dd291e37df2b36f5c5b1a457eed2))
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
-   **auth:** changed and condition to or for GitHub reputation checks ([aa3e732](https://github.com/quadratic-funding/mpc-phase2-suite/commit/aa3e732ba739070c65880574405b00c97ae2b664)), closes [#271](https://github.com/quadratic-funding/mpc-phase2-suite/issues/271)
-   **auth:** changed and condition to or for GitHub reputation checks ([f78979d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/f78979d946a06c8e99de334ae665f2a3433acf4a)), closes [#271](https://github.com/quadratic-funding/mpc-phase2-suite/issues/271)
-   **auth:** removed unneeded test stub ([387008a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/387008a181338a19e518529a6e6595b663811279))
-   cannot deploy cloud functions ([83f4928](https://github.com/quadratic-funding/mpc-phase2-suite/commit/83f4928367255b83c3a1c25c786f3ce395a02e48))
-   **ceremony verification:** add extra sleep on one test case ([271617d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/271617d97517c59dff1f080dd37abdd3993fb1ac))
-   **ceremony verification:** add missing d.ts files ([7cec92e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7cec92e99ded7a9295f3ba1020d16f0bb611eb58))
-   **ceremony verification:** ci test temp fix by skipping test case ([98504d3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/98504d37a97343bd89c6580fd85b7505d75102c9))
-   **ceremony verification:** remove redundant argument from export verifier function ([ec351de](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ec351def2a1104b825ead8619d65215431b38abb))
-   **ceremony verification:** removed redundant cleanup on emulator ([5690748](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5690748a9463d897f749410c06ac090af053f4de))
-   **ci test:** fix workflow name ([786feb2](https://github.com/quadratic-funding/mpc-phase2-suite/commit/786feb2bad8ef8df5d1a76c3558824b72b0f8d0e))
-   **ci test:** fix workflow name ([bdda740](https://github.com/quadratic-funding/mpc-phase2-suite/commit/bdda7401d1f82741ab2418563cef36fc0e89abce))
-   **ci test:** fixing workflow to run sequentially ([5fe70d3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5fe70d3432c42aa268f705543a1f4a2733e63e21))
-   **ci test:** fixing workflow to run sequentially ([c18f3f1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c18f3f1b861fb75f5dd40349dbd6e6b2948a33b9))
-   **ci test:** simplify workflow ([411bd3b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/411bd3b3e75338729db78ed175c24c2f36f500fd))
-   **ci test:** simplify workflow ([20c99a1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/20c99a19275beb4aef332063f5662a77de10727d))
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
-   **github sybil:** amended the code after PR review ([200cf7d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/200cf7d28ec10316f445d41511e3eb4c7facc249))
-   **github sybil:** amended the code after PR review ([6bbe77b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6bbe77bb6035c1607a0366ddbcdd29275d05c82e))
-   implement support for generating file hash larger than 2GB ([8138e72](https://github.com/quadratic-funding/mpc-phase2-suite/commit/8138e72b1177596ef991045bcd9b57c01403469f))
-   **lib.utils tests:** fixing lib.utils tests which cause a compilation error ([a953307](https://github.com/quadratic-funding/mpc-phase2-suite/commit/a9533076e909f2a3f01e3549830acd43597b22d1))
-   make spinner to stop properly ([d47de71](https://github.com/quadratic-funding/mpc-phase2-suite/commit/d47de71fa63c3e4ffabdda4155d83debf2e4947f))
-   missing imports; moved artifacts to correct folder ([28958f9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/28958f995654f5c3db0095410e4f9483e18bd3e5))
-   missing optional typing leading to wrong build ([4dab2e0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4dab2e013a292eea6a3ca1749578af666f5adff8))
-   missing pre-condition when resuming during computing step; wrong pre-condition on related cf ([90c8729](https://github.com/quadratic-funding/mpc-phase2-suite/commit/90c87295b771d099cffc43880e4e962cd64fd330))
-   **multipart upload:** fixed tests that failed due to the changes ([3e974f9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3e974f9c410afebf5b6cd952e1fcd80f06892468))
-   **multipart upload:** fixed tests that failed due to the changes ([5e12eb1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5e12eb1b72c2df2f301e91b6556c2d113065ac70))
-   **multipart upload:** fixed tests that failed due to the changes ([eded975](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eded975a42ed2d557c71c7e6592e2ae82fb46018))
-   **multipart upload:** lock down multipart upload ([407aaf0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/407aaf012eb56a83944acbbca5e5028a4294174f))
-   **multipart upload:** lock down multipart upload ([6ca3963](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6ca396397d0c8a31623402cc138324edb1e2abb2))
-   **multipart upload:** lock down multipart upload ([5629dd7](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5629dd78db426a897d6845263e8b7130f6c590cb))
-   **multipart upload:** shortening expression ([0c63567](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0c6356733ba403a49b4ede5b066272d71b07d679))
-   **multipart upload:** shortening expression ([5297e65](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5297e65ee4b6c66c6a2e7268164f9661d3c7ce09))
-   **multipart upload:** shortening expression ([2562ec8](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2562ec8c9545a7983b9dfdfb07c47c42438a1d8d))
-   next participant on the waiting queue did not automatically start the contribution ([7def977](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7def977fb507182053c9a02b4484d2d2c260fcb4))
-   **prod ci:** fix prod CI ([6cc3be0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6cc3be0c22edfbf7366dceec46e653f745e5cb73))
-   **prod ci:** fix prod CI ([7aa0636](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7aa063667e024ce3b774d108b2885493e050f55f))
-   remove unnecessary kill command to clean CI ([809de02](https://github.com/quadratic-funding/mpc-phase2-suite/commit/809de028e179bcafd4840892130688186de3b8ab))
-   **security rules:** adding missing authentication test utilities file ([fca06a4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/fca06a497f5760c9cfae02ec4cbbfb34cc1568bb))
-   **security rules:** fixed Firestore security rules ([2bb85f2](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2bb85f207ddcf5cc75b13b00ee82bcb51837d202))
-   **setup tests:** added missing file ([6e4e0b0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e4e0b0b082448f43711808c5e13833649638d0a))
-   **setup tests:** fixed bugs in tests and refactored ([a71c531](https://github.com/quadratic-funding/mpc-phase2-suite/commit/a71c53134b45ee688996f463716e64206401502c))
-   **signedurls:** commiting correct .default.env file ([6fe96b1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6fe96b197661115979b1691d7d31b4b5ee5467ea))
-   small bug fixes and minor changes ([0a0d44a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0a0d44aa4f74aea2140ee68bc5547009611f2372))
-   **storage tests:** fixed storage tests after backend refactoring ([15788ea](https://github.com/quadratic-funding/mpc-phase2-suite/commit/15788ea5388a3bb9bb601bfd4915e158019366a0))
-   **storage tests:** fixed storage tests after backend refactoring ([02fa6e3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/02fa6e3238d6ec1ebcdd3389d2278fa0b08a7659))
-   sync tests ([10c2d9f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/10c2d9f8503e1a61c33bd105e9360f9b5b0ecb05))
-   **test ci:** fix prod ci workflow ([db2eee0](https://github.com/quadratic-funding/mpc-phase2-suite/commit/db2eee0e77b7239db9fd7870f3423346afc7d452))
-   **test ci:** fix prod ci workflow ([d31a206](https://github.com/quadratic-funding/mpc-phase2-suite/commit/d31a206a29d1975a1d441594c8090c2e518b48c7))
-   **test ci:** remove external dependency to deploy ([1745688](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1745688495955f8acfe25dee93c674aac15011dc))
-   **test ci:** remove external dependency to deploy ([14af312](https://github.com/quadratic-funding/mpc-phase2-suite/commit/14af312777057f6c5b36bdf728656f730f9b171d))
-   **tests:** add more timeout in contribution test ([0e794e7](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0e794e74ad23684b8d91deae5ecbe5ac6dc96032))
-   **tests:** adding uncommited files ([efda66e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/efda66e38250a0a63dcdd3ff1a011588c298c803))
-   **tests:** adding uncommited files ([59b73a9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/59b73a96b9af2b526d501fdee4d1f39b1ae5219a))
-   **tests:** fix tests on the ci which sometimes fail ([8e8f8f9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/8e8f8f972a82917fd084b422a43dbd4b2f8cabbe))
-   **tests:** fixed failing tests and added more cleanup functions ([b411891](https://github.com/quadratic-funding/mpc-phase2-suite/commit/b411891eaa64dd6c488f5bf7be79785e28722fde))
-   **tests:** fixed failing tests and added more cleanup functions ([26baaec](https://github.com/quadratic-funding/mpc-phase2-suite/commit/26baaec4b5a697a62dc092503134124b6b15aa38))
-   **tests:** pr review comments ([11f592a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/11f592a2bab116f2d972e65a07da45c3a1a33ca5))
-   **tests:** refactoring of older test suites and added extra ci action ([30a6f4c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/30a6f4ce2c509b1a942abb147cef733601b309ad))
-   **tests:** refactoring of older test suites and added extra ci action ([9af9529](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9af9529a6061c3e0f294163165313799a049dd61))
-   **tests:** remove test ci trigger ([d3deccb](https://github.com/quadratic-funding/mpc-phase2-suite/commit/d3deccb6b7d9bd33980f91a3ed4b6a80e70d6cba))
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
-   wrong import ([8fdc432](https://github.com/quadratic-funding/mpc-phase2-suite/commit/8fdc432994dbf73fbf8fa9b02b3887fd2d6c5a30))
-   wrong path ([549d024](https://github.com/quadratic-funding/mpc-phase2-suite/commit/549d024d29624efaab5f8aac9c777ddd1d492624))
-   wrong variable type lead to cfs inconsistency ([0003f4a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0003f4a8cf8127821a5e013b7a319d3fccf94381))
-   wrong version for peer dependency actions package ([4975d96](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4975d96928ec2f02dab99c493f9b4e65ff6ec983))

### Code Refactoring

-   update and move constants to actions package ([e1a98a8](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e1a98a8d4b33c589a4a32300e9ad03c9a647c05b))

## [0.1.0](https://github.com/quadratic-funding/mpc-phase2-suite/compare/v0.0.1...v0.1.0) (2023-01-24)

### ⚠ BREAKING CHANGES

-   The folder structure and build process (now using lerna)

### Features

-   a ([d5b8681](https://github.com/quadratic-funding/mpc-phase2-suite/commit/d5b868140968b9600ea82c502fd5c78c113a0f57))
-   **setup:** decoupling setup from the cli ([9e8b3df](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9e8b3df4640facc35dbe79b19d8f436768f74c6d)), closes [#217](https://github.com/quadratic-funding/mpc-phase2-suite/issues/217)

### Bug Fixes

-   add missing passwordless sudo to command for getting privileges ([236b73e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/236b73e71d9a18d133049f3a2af681ac397b0b4e))
-   fix failure of yarn install command when using Node.js v18 ([3a4b04f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3a4b04f77d0fb78773d527e4b6d1f696b3ca2cfd))
-   major and minor bugs from contribute command refactoring PR ([3697c69](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3697c69f959cc86cb966cab207f2e78bf25e8fbd)), closes [#247](https://github.com/quadratic-funding/mpc-phase2-suite/issues/247)
-   missing conditional for alternative workflow when session is maintained with Github ([6b67294](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6b672948285fcd9cc42d4500263bfd2656cfc697))
-   missing export; nit refactor testing storage config w/ helper ([162292a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/162292a196fecc63e7c42a9210ad3bfdf0fe2aa7))
-   missing parameter value when calling query method for getting documents ([38a16e6](https://github.com/quadratic-funding/mpc-phase2-suite/commit/38a16e6a3d5c3293ed7042e6f0129730b5a4424f))
-   missing path update when using a pre-computed zkey ([4c66929](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4c66929f55ecc24dc8287952237d8bdf36170c0e))
-   missing status check for request ([802dd4a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/802dd4a0ef5b69dfd9d2d8ac5f3349ec25f2982a))
-   missing status check for request ([bf0fbab](https://github.com/quadratic-funding/mpc-phase2-suite/commit/bf0fbaba3ab89b6d57dcd4dfa410129e55e04a2c))
-   remove duplicated code ([9bb4938](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9bb49389c358ff2369a44f02866c56957c9173db))
-   remove oauth token when it is invalid ([056ab25](https://github.com/quadratic-funding/mpc-phase2-suite/commit/056ab25b247e06828724b1a8affe5f1755fe5862))
-   remove optional Firebase config ([3724953](https://github.com/quadratic-funding/mpc-phase2-suite/commit/372495365b2b5b57aa06082ce5d12cbe23188a2f))
-   wrong cpu value for verifycontribution cloud function and missing ci token ([c992239](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c9922391b96b23c412895beccb8d6174c1afedd5))
-   wrong npm script ([420db80](https://github.com/quadratic-funding/mpc-phase2-suite/commit/420db80f108e011fe36cb06c8d99f677f53c4b91))
-   wrong usage of secrets in development test pipeline ([e122c19](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e122c19af838a37e160080fc6c2960f0c4cba856))

### Performance Improvements

-   use re-export instead of import/export ([e3ef96b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e3ef96bdd6807da985ec09db5730d75697ff55cf))

### Code Refactoring

-   add fake data generators and pre-generated samples for testing ([4bcb907](https://github.com/quadratic-funding/mpc-phase2-suite/commit/4bcb9076b10f22bbb9b6d08b6f5938ab8c3cc715))
-   **contribute:** fixed error with return value of cloud functions ([c11bc4d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/c11bc4d75dcb4394cf0c2f398b18154775657ac2))
-   **contribute:** refactoring the contribute command ([69947b5](https://github.com/quadratic-funding/mpc-phase2-suite/commit/69947b55b50bd07a30398523da45209bfc6a745d))
-   decouple finalize command; minor fixes ([dd0e7ee](https://github.com/quadratic-funding/mpc-phase2-suite/commit/dd0e7ee9ddbbe8c99c94cb87aeff9740affcb2a2))
-   decouple of observe command; minor fixes ([455e8b1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/455e8b1fb48c4d7650d1417a367efd7cd34b58f1))
-   extend configuration of firebase application; testing utilities update accordingly ([6e7ee8a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/6e7ee8a2d186cb8f80570158f2e25f6d5b115c61))
-   modularize clean command by moving files helpers to actions package; sync other commands ([06e31bf](https://github.com/quadratic-funding/mpc-phase2-suite/commit/06e31bfdef1df88ebdbd9afc3d4f55ef99713f3f))
-   monorepo config and e2e bootstrap; minor fixes and improvements ([cb25f4e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/cb25f4e8e2f94ff7f9ab2587e91d5db6c5d6a982))
-   optimize auth command and related libraries separation; generalize core lib methods ([7bc462c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7bc462c56cd1c876622c80471c3ba34135890c0f))
-   optimize auth command and related libraries separation; generalize core lib methods ([9582a57](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9582a578dd564b1adebea49c8f4d17de732b7d4b))
-   remove duplicated collectCoverageFrom property from jest config ([b6a21bf](https://github.com/quadratic-funding/mpc-phase2-suite/commit/b6a21bfb7efaa9fa9a2ec6e52d883c5ef2a8aa82))
-   separation between dev and prod envs; improved utilities; relocate e2e tests ([1ccf4d1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1ccf4d1d6880bd2c7423447b7293241d885c4664))
-   **setup:** implemented review suggestions ([82c4ea1](https://github.com/quadratic-funding/mpc-phase2-suite/commit/82c4ea14b29776c4208ce78f84128ae233afcbe3))
-   **storage helpers:** refactoring storage helpers to accept extra arguments ([efe3088](https://github.com/quadratic-funding/mpc-phase2-suite/commit/efe30887c0110dca7686ef4502ad0c7591d7bdc4))
-   switch to monorepo approach by separating the CLI from the actions; renamings and minors ([eda21d4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/eda21d4e5b319fac1346a184dd61df3ea447f28f)), closes [#175](https://github.com/quadratic-funding/mpc-phase2-suite/issues/175)

### Miscellaneous

-   add a documentation template ([0f4d1e7](https://github.com/quadratic-funding/mpc-phase2-suite/commit/0f4d1e7af6db83fce90a9339eebd9b5211a547c9))
-   add a pre-commit hook to enforce linting automatically ([9f8af58](https://github.com/quadratic-funding/mpc-phase2-suite/commit/9f8af5846c3afb89289a082ed01d110202d89b9a))
-   add github device flow authentication test using non-headless browser ([ee4d6d3](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ee4d6d307747a9e0f06fd9b10fe61cb87e6881bc))
-   add missing clean up for users and authentication service; workaround for waiting CF execution ([e484a7b](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e484a7b7c40f8b3fdceb92128a8380ddb31092fb))
-   add missing config values ([675b739](https://github.com/quadratic-funding/mpc-phase2-suite/commit/675b7390ac52721d6862ca80980b91b8d4932ac2))
-   add missing yarn.lock file ([2bbcb9c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2bbcb9c661fc56e8022d9090fb7e6da10a8a3f05))
-   add timeout and removed wrong folders from coverage collection ([31fffca](https://github.com/quadratic-funding/mpc-phase2-suite/commit/31fffca9d6975b617197860a27c11a16b7e1d2a1))
-   apply default value to config file ([3c2b7aa](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3c2b7aa3d90b2bdae20d2ee819681f1b0dc0344c))
-   bootstrap unit test for firebase core auth helpers ([2e98d14](https://github.com/quadratic-funding/mpc-phase2-suite/commit/2e98d145ffa7282c474cca92eb490c2a7debcab0))
-   bump firebase-functions to 4.1.1 ([5668732](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5668732bd789c5b08b8d54e64bb3e6256888df0b))
-   **changelog:** add CHANGELOG ([e0ecdfe](https://github.com/quadratic-funding/mpc-phase2-suite/commit/e0ecdfe07473543b9323f8c3adeecfe19ed2c4ba))
-   lint and fix import ([44e6e6c](https://github.com/quadratic-funding/mpc-phase2-suite/commit/44e6e6c39cafc1c9a4644ff182d9f7d31acdb9e8))
-   missing doc reference for firebase app ([1fc12c9](https://github.com/quadratic-funding/mpc-phase2-suite/commit/1fc12c9f9cce2c1ea7860e5e835b8af789ce1f31))
-   remove author section from package.json and update license author ([ed0173a](https://github.com/quadratic-funding/mpc-phase2-suite/commit/ed0173a45ecd52836a7063817edee4cc4a89275f))
-   remove unnecessary values ([3deaf7f](https://github.com/quadratic-funding/mpc-phase2-suite/commit/3deaf7fcfaf7ccfdaf238eca5eca58bcc8026f3f))
-   removed unnecessary prebuild scripts; minor config for node version and main entry point ([7385223](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7385223e2d168179390a14536dd0683ea0bb9e68))
-   **setup:** added test stubs for setup action ([bd46594](https://github.com/quadratic-funding/mpc-phase2-suite/commit/bd4659414546666c72fd9ce5c0a8fa0f0a8277ea))
-   **setup:** fixed setup test ([7d84854](https://github.com/quadratic-funding/mpc-phase2-suite/commit/7d84854652928de5694452674362cd2ebf185cb3))
-   update jest config timeout ([730c94d](https://github.com/quadratic-funding/mpc-phase2-suite/commit/730c94d0fe933ff5fb1ea8e6bf0b4ce36d75de69))
-   update timeout for tests ([998824e](https://github.com/quadratic-funding/mpc-phase2-suite/commit/998824ea6b1f806f096766d2ad96c14cf3bc8254))
-   wIP e2e and contribute command decoupling ([5b068c4](https://github.com/quadratic-funding/mpc-phase2-suite/commit/5b068c4199df8729ad1ef042701e11ad487a32d2))
