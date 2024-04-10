# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.



**Note:** Version bump only for package @p0tion/backend





## [1.2.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.2.0...v1.2.1) (2024-04-10)

**Note:** Version bump only for package @p0tion/backend





## [1.2.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.1.1...v1.2.0) (2024-04-05)

**Note:** Version bump only for package @p0tion/backend





## [1.1.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.8...v1.1.1) (2024-01-06)


### Features

* **cors:** add more CORS options ([976dcb1](https://github.com/privacy-scaling-explorations/p0tion/commit/976dcb193538bc1bbf3f95cff789972a4b2355d5))
* **sybil:** add GH age check ([bcb670c](https://github.com/privacy-scaling-explorations/p0tion/commit/bcb670c994f8ee6699207ebe98939b91d49b7ad6))


### Bug Fixes

* don't reject on first iteration of waitForVMCommandExecutioncution ([cc475a0](https://github.com/privacy-scaling-explorations/p0tion/commit/cc475a00b8f32380c94bb1cdb140d119bddeab55))
* some typos ([71104c0](https://github.com/privacy-scaling-explorations/p0tion/commit/71104c07562d8d185e589846bb834d2a4c40afe8))
* **timeout:** allow larger timeout when generating signed-urls for upload ([b2228c1](https://github.com/privacy-scaling-explorations/p0tion/commit/b2228c19a6ea071e7d322a1d61c51a746e41958d))
* **timeout:** fix issue with timing out while in upload phase ([35c6088](https://github.com/privacy-scaling-explorations/p0tion/commit/35c608829776473602b1cf7bdf2b453e1d56e0c4))
* **timeout:** fix wrong variable name from desconstructing ceremony data ([28abe70](https://github.com/privacy-scaling-explorations/p0tion/commit/28abe703d3ce47a11d8f1183126c79634d4570c5))
* use instance profile ARN to start instance ([c20871e](https://github.com/privacy-scaling-explorations/p0tion/commit/c20871efb745f5a2d6671bd7cd054350383c8888))
* **vm:** add try catch on SSM polling ([3c81c85](https://github.com/privacy-scaling-explorations/p0tion/commit/3c81c852ac4e9c05c94c962a3f4ff182627072bb))
* **vm:** always stop the VM even on SSM errors ([531dcd6](https://github.com/privacy-scaling-explorations/p0tion/commit/531dcd6563a94c3944857432213d98779ec8974a))
* **vm:** fix VM setup ([1e5d894](https://github.com/privacy-scaling-explorations/p0tion/commit/1e5d894c9a321da4cddec096dad2ad8a325d155f))
* **vm:** stop vm even on verification failing ([a3cbf07](https://github.com/privacy-scaling-explorations/p0tion/commit/a3cbf072bb6d29d53966c4e90ddef36f6607b372))



## [1.0.5](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.4...v1.0.5) (2023-07-24)

**Note:** Version bump only for package @p0tion/backend

## [1.0.4](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.2...v1.0.4) (2023-07-20)

**Note:** Version bump only for package @p0tion/backend

## [1.0.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v1.0.1...v1.0.2) (2023-07-20)

### Bug Fixes

-   **vms:** fix default region ([14e9f49](https://github.com/privacy-scaling-explorations/p0tion/commit/14e9f49a6c1f83523c9ce16827b8ff056161e3b2))
-   **vms:** specify region in sns command ([1cc1485](https://github.com/privacy-scaling-explorations/p0tion/commit/1cc148533d1fedabaec0220c4dd55f16f9131ff4))

## [1.0.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v1.0.1) (2023-07-19)

### Features

-   **ec2:** added tests and ip function ([2658c1a](https://github.com/privacy-scaling-explorations/p0tion/commit/2658c1a049c8fa79dde93617d6a7190c53e6ad9f))
-   **ec2:** fixed bug in running commands at deployment and refactored setup ([f7e8de7](https://github.com/privacy-scaling-explorations/p0tion/commit/f7e8de702faa62565e197073db6096cf6734955a))
-   **ec2:** merge udpates and add tests ([5e8a76f](https://github.com/privacy-scaling-explorations/p0tion/commit/5e8a76fe68154998b72ab12b478a057c91da8bf4))
-   **setup:** add cloud function for file transfer and unit tests ([f7b059d](https://github.com/privacy-scaling-explorations/p0tion/commit/f7b059db9bca336c981980a93a2d422d643d183f))
-   **setup:** non interactive setup with artifacts download ([d032f37](https://github.com/privacy-scaling-explorations/p0tion/commit/d032f37a609448ec1741cd822967737c4d37515b))
-   **setup:** remove return value and amend tests ([c407bee](https://github.com/privacy-scaling-explorations/p0tion/commit/c407bee2225758ce10f99842a1f63f41d28f62db))
-   **vms:** added ssm code and more tests + changes on backend ([f9a251a](https://github.com/privacy-scaling-explorations/p0tion/commit/f9a251a9cc9812e28956a003a17ea2046fcdf10b))
-   **vms:** implement SNS topic command to trigger Lambda that stops the VM after initialization ([f5f73bb](https://github.com/privacy-scaling-explorations/p0tion/commit/f5f73bb546aeefa8da263dacbef7e84eb2bb97e6))
-   **vms:** implement terraform script to deploy AWS inf ([b168cd0](https://github.com/privacy-scaling-explorations/p0tion/commit/b168cd0b8461c79fd18a3aa2334a8aff24b93bcc))
-   **vms:** implemented e2e test for contribution verification ([684123a](https://github.com/privacy-scaling-explorations/p0tion/commit/684123af219d7ad4b38d8f1378952f657982e845))
-   **vms:** refactoring ([08486b2](https://github.com/privacy-scaling-explorations/p0tion/commit/08486b2fc1e3b871f1bf2a341a1bc394063ddf06))
-   **vms:** tests and refactoring ([3a19f95](https://github.com/privacy-scaling-explorations/p0tion/commit/3a19f952f2206de7d5a04f511dc7a947e47e50ad))

### Bug Fixes

-   correct failing tests ([f55e832](https://github.com/privacy-scaling-explorations/p0tion/commit/f55e832391ebf0d42340dfb8ce3727977016ecc2))
-   imports and package version ([8b8b84f](https://github.com/privacy-scaling-explorations/p0tion/commit/8b8b84fa836a2a33f549c3a4dfd26adc4a3c79c5))
-   missing else statement for verifycontribution function; wrong return on custom promise ([716843d](https://github.com/privacy-scaling-explorations/p0tion/commit/716843dbd393a105536c4f2d221ee0cd021439c9))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   **setup:** revert transfer of object and add region to config ([690da25](https://github.com/privacy-scaling-explorations/p0tion/commit/690da25addc9005ec3a5ce21a22fb7044293f772))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   **verifycontribution:** fix issue with failing to deconstruct undefined object (vm) ([12b99f1](https://github.com/privacy-scaling-explorations/p0tion/commit/12b99f153c5f59ac5d4a86281331a95f9a7870f7))
-   **vm:** bug fix ([f4ae99d](https://github.com/privacy-scaling-explorations/p0tion/commit/f4ae99d586f625ac073ce079f100a25e21b77d25))
-   **vm:** missing files ([64f5019](https://github.com/privacy-scaling-explorations/p0tion/commit/64f50195905d472d07de2e007382ab49ab7f9642))
-   **vms:** add tags on EC2 creation ([0347289](https://github.com/privacy-scaling-explorations/p0tion/commit/0347289f414800d2c7ce45ba1bafe4e36e32788b))
-   **vms:** disable eslint rule for regex ([2c426cb](https://github.com/privacy-scaling-explorations/p0tion/commit/2c426cb8145ca6c533f12a47aae5d7d66b6c1808))
-   **vms:** fix cloud function bug related to the wrong verification transcript path ([db35a5f](https://github.com/privacy-scaling-explorations/p0tion/commit/db35a5f0010be7b84217ba5fd146a7adf245e5dc))
-   **vms:** fix emulator tests ([98af9d0](https://github.com/privacy-scaling-explorations/p0tion/commit/98af9d021ca72c173e1da491da1bfd859862c8e6))
-   **vms:** fix terraform and lambda config ([2714912](https://github.com/privacy-scaling-explorations/p0tion/commit/271491275f6ad75510f4018f01594720afa93a6c))
-   **vms:** fix VM commands ([a39fd5f](https://github.com/privacy-scaling-explorations/p0tion/commit/a39fd5fa9543af412eae7f7e505660547c29b4b3))
-   **vms:** fixed cloud function for VM verification ([3ca22a5](https://github.com/privacy-scaling-explorations/p0tion/commit/3ca22a53253f500caa0227b529aed0d145433295))
-   **vms:** fixed wrong path in blake3 bin command and various fixes on the verification CF ([9aec4e7](https://github.com/privacy-scaling-explorations/p0tion/commit/9aec4e7188653acb4bdce5f17f5a161918ee768d))
-   **vms:** refactoring and code fixes ([0ebe401](https://github.com/privacy-scaling-explorations/p0tion/commit/0ebe401894befb4dddab414392bcb29e656ba456))
-   **vms:** remove redundant parameter on VM startup - ssh keypair ([8f3dc42](https://github.com/privacy-scaling-explorations/p0tion/commit/8f3dc42f6ddad9c755ae6e2370b6a783f6aae306))
-   **vms:** removed stdin/stdout redirection in VM command and added regex match for blake3 hash ([0bf3034](https://github.com/privacy-scaling-explorations/p0tion/commit/0bf30346fe60850df76e3125866bdaeda86cc502))
-   **vms:** retry mechanism for VM startup ([1f5accd](https://github.com/privacy-scaling-explorations/p0tion/commit/1f5accd6c85a909eeee365c539af8f6f6b558122))
-   **vms:** revert part of the verifyContribution refactoring and update terraform ([1e74a4c](https://github.com/privacy-scaling-explorations/p0tion/commit/1e74a4c2a9ecf20e8b2610546b0edeb1a098d7bb))
-   **vms:** temp revert of retry feature in verifyContribution ([5d0375d](https://github.com/privacy-scaling-explorations/p0tion/commit/5d0375d4bc90646a9225cf7ffb280e1ec0df52ee))
-   **vms:** tests ([dfbf3a7](https://github.com/privacy-scaling-explorations/p0tion/commit/dfbf3a7422e773d87d5d1e94ddc1a85aa99c6220))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))

## [1.0.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v1.0.0) (2023-07-11)

### Features

-   **ec2:** added tests and ip function ([2658c1a](https://github.com/privacy-scaling-explorations/p0tion/commit/2658c1a049c8fa79dde93617d6a7190c53e6ad9f))
-   **ec2:** fixed bug in running commands at deployment and refactored setup ([f7e8de7](https://github.com/privacy-scaling-explorations/p0tion/commit/f7e8de702faa62565e197073db6096cf6734955a))
-   **ec2:** merge udpates and add tests ([5e8a76f](https://github.com/privacy-scaling-explorations/p0tion/commit/5e8a76fe68154998b72ab12b478a057c91da8bf4))
-   **vms:** added ssm code and more tests + changes on backend ([f9a251a](https://github.com/privacy-scaling-explorations/p0tion/commit/f9a251a9cc9812e28956a003a17ea2046fcdf10b))
-   **vms:** implement SNS topic command to trigger Lambda that stops the VM after initialization ([f5f73bb](https://github.com/privacy-scaling-explorations/p0tion/commit/f5f73bb546aeefa8da263dacbef7e84eb2bb97e6))
-   **vms:** implement terraform script to deploy AWS inf ([b168cd0](https://github.com/privacy-scaling-explorations/p0tion/commit/b168cd0b8461c79fd18a3aa2334a8aff24b93bcc))
-   **vms:** implemented e2e test for contribution verification ([684123a](https://github.com/privacy-scaling-explorations/p0tion/commit/684123af219d7ad4b38d8f1378952f657982e845))
-   **vms:** refactoring ([08486b2](https://github.com/privacy-scaling-explorations/p0tion/commit/08486b2fc1e3b871f1bf2a341a1bc394063ddf06))
-   **vms:** tests and refactoring ([3a19f95](https://github.com/privacy-scaling-explorations/p0tion/commit/3a19f952f2206de7d5a04f511dc7a947e47e50ad))

### Bug Fixes

-   correct failing tests ([f55e832](https://github.com/privacy-scaling-explorations/p0tion/commit/f55e832391ebf0d42340dfb8ce3727977016ecc2))
-   imports and package version ([8b8b84f](https://github.com/privacy-scaling-explorations/p0tion/commit/8b8b84fa836a2a33f549c3a4dfd26adc4a3c79c5))
-   missing else statement for verifycontribution function; wrong return on custom promise ([716843d](https://github.com/privacy-scaling-explorations/p0tion/commit/716843dbd393a105536c4f2d221ee0cd021439c9))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   **vm:** bug fix ([f4ae99d](https://github.com/privacy-scaling-explorations/p0tion/commit/f4ae99d586f625ac073ce079f100a25e21b77d25))
-   **vm:** missing files ([64f5019](https://github.com/privacy-scaling-explorations/p0tion/commit/64f50195905d472d07de2e007382ab49ab7f9642))
-   **vms:** add tags on EC2 creation ([0347289](https://github.com/privacy-scaling-explorations/p0tion/commit/0347289f414800d2c7ce45ba1bafe4e36e32788b))
-   **vms:** disable eslint rule for regex ([2c426cb](https://github.com/privacy-scaling-explorations/p0tion/commit/2c426cb8145ca6c533f12a47aae5d7d66b6c1808))
-   **vms:** fix cloud function bug related to the wrong verification transcript path ([db35a5f](https://github.com/privacy-scaling-explorations/p0tion/commit/db35a5f0010be7b84217ba5fd146a7adf245e5dc))
-   **vms:** fix emulator tests ([98af9d0](https://github.com/privacy-scaling-explorations/p0tion/commit/98af9d021ca72c173e1da491da1bfd859862c8e6))
-   **vms:** fix terraform and lambda config ([2714912](https://github.com/privacy-scaling-explorations/p0tion/commit/271491275f6ad75510f4018f01594720afa93a6c))
-   **vms:** fix VM commands ([a39fd5f](https://github.com/privacy-scaling-explorations/p0tion/commit/a39fd5fa9543af412eae7f7e505660547c29b4b3))
-   **vms:** fixed cloud function for VM verification ([3ca22a5](https://github.com/privacy-scaling-explorations/p0tion/commit/3ca22a53253f500caa0227b529aed0d145433295))
-   **vms:** fixed wrong path in blake3 bin command and various fixes on the verification CF ([9aec4e7](https://github.com/privacy-scaling-explorations/p0tion/commit/9aec4e7188653acb4bdce5f17f5a161918ee768d))
-   **vms:** refactoring and code fixes ([0ebe401](https://github.com/privacy-scaling-explorations/p0tion/commit/0ebe401894befb4dddab414392bcb29e656ba456))
-   **vms:** remove redundant parameter on VM startup - ssh keypair ([8f3dc42](https://github.com/privacy-scaling-explorations/p0tion/commit/8f3dc42f6ddad9c755ae6e2370b6a783f6aae306))
-   **vms:** removed stdin/stdout redirection in VM command and added regex match for blake3 hash ([0bf3034](https://github.com/privacy-scaling-explorations/p0tion/commit/0bf30346fe60850df76e3125866bdaeda86cc502))
-   **vms:** retry mechanism for VM startup ([1f5accd](https://github.com/privacy-scaling-explorations/p0tion/commit/1f5accd6c85a909eeee365c539af8f6f6b558122))
-   **vms:** revert part of the verifyContribution refactoring and update terraform ([1e74a4c](https://github.com/privacy-scaling-explorations/p0tion/commit/1e74a4c2a9ecf20e8b2610546b0edeb1a098d7bb))
-   **vms:** temp revert of retry feature in verifyContribution ([5d0375d](https://github.com/privacy-scaling-explorations/p0tion/commit/5d0375d4bc90646a9225cf7ffb280e1ec0df52ee))
-   **vms:** tests ([dfbf3a7](https://github.com/privacy-scaling-explorations/p0tion/commit/dfbf3a7422e773d87d5d1e94ddc1a85aa99c6220))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))

## [0.5.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.5.0) (2023-07-04)

### Features

-   **ec2:** added tests and ip function ([2658c1a](https://github.com/privacy-scaling-explorations/p0tion/commit/2658c1a049c8fa79dde93617d6a7190c53e6ad9f))
-   **ec2:** fixed bug in running commands at deployment and refactored setup ([f7e8de7](https://github.com/privacy-scaling-explorations/p0tion/commit/f7e8de702faa62565e197073db6096cf6734955a))
-   **ec2:** merge udpates and add tests ([5e8a76f](https://github.com/privacy-scaling-explorations/p0tion/commit/5e8a76fe68154998b72ab12b478a057c91da8bf4))
-   **vms:** added ssm code and more tests + changes on backend ([f9a251a](https://github.com/privacy-scaling-explorations/p0tion/commit/f9a251a9cc9812e28956a003a17ea2046fcdf10b))
-   **vms:** implement SNS topic command to trigger Lambda that stops the VM after initialization ([f5f73bb](https://github.com/privacy-scaling-explorations/p0tion/commit/f5f73bb546aeefa8da263dacbef7e84eb2bb97e6))
-   **vms:** implement terraform script to deploy AWS inf ([b168cd0](https://github.com/privacy-scaling-explorations/p0tion/commit/b168cd0b8461c79fd18a3aa2334a8aff24b93bcc))
-   **vms:** implemented e2e test for contribution verification ([684123a](https://github.com/privacy-scaling-explorations/p0tion/commit/684123af219d7ad4b38d8f1378952f657982e845))
-   **vms:** refactoring ([08486b2](https://github.com/privacy-scaling-explorations/p0tion/commit/08486b2fc1e3b871f1bf2a341a1bc394063ddf06))
-   **vms:** tests and refactoring ([3a19f95](https://github.com/privacy-scaling-explorations/p0tion/commit/3a19f952f2206de7d5a04f511dc7a947e47e50ad))

### Bug Fixes

-   correct failing tests ([f55e832](https://github.com/privacy-scaling-explorations/p0tion/commit/f55e832391ebf0d42340dfb8ce3727977016ecc2))
-   imports and package version ([8b8b84f](https://github.com/privacy-scaling-explorations/p0tion/commit/8b8b84fa836a2a33f549c3a4dfd26adc4a3c79c5))
-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   **vm:** bug fix ([f4ae99d](https://github.com/privacy-scaling-explorations/p0tion/commit/f4ae99d586f625ac073ce079f100a25e21b77d25))
-   **vm:** missing files ([64f5019](https://github.com/privacy-scaling-explorations/p0tion/commit/64f50195905d472d07de2e007382ab49ab7f9642))
-   **vms:** add tags on EC2 creation ([0347289](https://github.com/privacy-scaling-explorations/p0tion/commit/0347289f414800d2c7ce45ba1bafe4e36e32788b))
-   **vms:** disable eslint rule for regex ([2c426cb](https://github.com/privacy-scaling-explorations/p0tion/commit/2c426cb8145ca6c533f12a47aae5d7d66b6c1808))
-   **vms:** fix cloud function bug related to the wrong verification transcript path ([db35a5f](https://github.com/privacy-scaling-explorations/p0tion/commit/db35a5f0010be7b84217ba5fd146a7adf245e5dc))
-   **vms:** fix emulator tests ([98af9d0](https://github.com/privacy-scaling-explorations/p0tion/commit/98af9d021ca72c173e1da491da1bfd859862c8e6))
-   **vms:** fix terraform and lambda config ([2714912](https://github.com/privacy-scaling-explorations/p0tion/commit/271491275f6ad75510f4018f01594720afa93a6c))
-   **vms:** fix VM commands ([a39fd5f](https://github.com/privacy-scaling-explorations/p0tion/commit/a39fd5fa9543af412eae7f7e505660547c29b4b3))
-   **vms:** fixed cloud function for VM verification ([3ca22a5](https://github.com/privacy-scaling-explorations/p0tion/commit/3ca22a53253f500caa0227b529aed0d145433295))
-   **vms:** fixed wrong path in blake3 bin command and various fixes on the verification CF ([9aec4e7](https://github.com/privacy-scaling-explorations/p0tion/commit/9aec4e7188653acb4bdce5f17f5a161918ee768d))
-   **vms:** refactoring and code fixes ([0ebe401](https://github.com/privacy-scaling-explorations/p0tion/commit/0ebe401894befb4dddab414392bcb29e656ba456))
-   **vms:** remove redundant parameter on VM startup - ssh keypair ([8f3dc42](https://github.com/privacy-scaling-explorations/p0tion/commit/8f3dc42f6ddad9c755ae6e2370b6a783f6aae306))
-   **vms:** removed stdin/stdout redirection in VM command and added regex match for blake3 hash ([0bf3034](https://github.com/privacy-scaling-explorations/p0tion/commit/0bf30346fe60850df76e3125866bdaeda86cc502))
-   **vms:** temp revert of retry feature in verifyContribution ([5d0375d](https://github.com/privacy-scaling-explorations/p0tion/commit/5d0375d4bc90646a9225cf7ffb280e1ec0df52ee))
-   **vms:** tests ([dfbf3a7](https://github.com/privacy-scaling-explorations/p0tion/commit/dfbf3a7422e773d87d5d1e94ddc1a85aa99c6220))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))

## [0.4.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.2) (2023-05-31)

### Bug Fixes

-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))

## [0.4.1](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.1) (2023-05-31)

### Bug Fixes

-   missing sort for ceremony circuits ([819b792](https://github.com/privacy-scaling-explorations/p0tion/commit/819b7928e0dd40b143b3013513e5a29649cc26f8))
-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))
-   wrong ci env project ([1304473](https://github.com/privacy-scaling-explorations/p0tion/commit/1304473cf4d6122b9866e60fbecf936a3961a608))
-   wrong document property lead to error when checking github antisybil ([fbe22ea](https://github.com/privacy-scaling-explorations/p0tion/commit/fbe22ea6d84becee1dcb8b1beb594de5c11a25ae))

## [0.4.0](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.4.0) (2023-05-19)

### Bug Fixes

-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   **s3:** creating public bucket with object ACL enabled ([12ad715](https://github.com/privacy-scaling-explorations/p0tion/commit/12ad715e09cd6fe0efb43604b6c5a7201194cd56))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))
-   **sybil checks:** amended env var name and added to the backend ([c28e2f0](https://github.com/privacy-scaling-explorations/p0tion/commit/c28e2f0579cc86f716731d793fccfb31e14d11c7))
-   unconsistency when resuming a contribution ([07fc79b](https://github.com/privacy-scaling-explorations/p0tion/commit/07fc79b8415935eb7f5d0f11372f60d04f7d997c))

## [0.3.5](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.5) (2023-05-17)

### Bug Fixes

-   missing updates for current contributor fields when coordinating ([88a730b](https://github.com/privacy-scaling-explorations/p0tion/commit/88a730b7ba44093127320197e888b3579255ba5b))
-   spinner does not stop correctly after contribution verification ([345bdcb](https://github.com/privacy-scaling-explorations/p0tion/commit/345bdcb8a09915aba29b37ac988b7109a67490e0))

## [0.3.2](https://github.com/privacy-scaling-explorations/p0tion/compare/v0.3.0...v0.3.2) (2023-05-17)

### Bug Fixes

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
