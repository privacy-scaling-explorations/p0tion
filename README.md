<p align="center">
    <h1 align="center">
      <!-- <picture>
        <source media="(prefers-color-scheme: dark)" srcset="ref-dark.svg">
        <source media="(prefers-color-scheme: light)" srcset="ref-light.svg">
        <img width="40" alt="p0tion icon" src="ref">
      </picture> -->
     🧪 p0tion 🧪 
    </h1>
</p>

<p align="center">
    <a alt="Project p0tion" href="https://github.com/privacy-scaling-explorations/p0tion" target="_blank">
        <img src="https://img.shields.io/badge/project-p0tion-blue.svg?style=flat-square">
    </a>
    <a href="/LICENSE">
        <img alt="GitHub License" src="https://img.shields.io/github/license/privacy-scaling-explorations/p0tion?style=flat-square">
    </a>
    <a href="https://github.com/privacy-scaling-explorations/p0tion/actions/workflows/test-ci-prod.yaml">
        <img alt="GitHub Workflow Test CI Prod" src="https://img.shields.io/github/actions/workflow/status/privacy-scaling-explorations/p0tion/test-ci-prod.yaml?branch=main&label=test&style=flat-square&logo=github">
    </a>
    <a href='https://coveralls.io/github/privacy-scaling-explorations/p0tion?branch=main'>
    <img src='https://coveralls.io/repos/github/privacy-scaling-explorations/p0tion/badge.svg?branch=main' alt='Coverage Status' />
    </a>
    <!-- <a href="https://deepscan.io/dashboard#view=project&tid=X&pid=X&bid=X">
        <img src="https://deepscan.io/api/teams/X/projects/X/branches/X/badge/grade.svg" alt="DeepScan grade">
    </a> -->
    <a href="https://eslint.org/">
        <img alt="Linter ESLint" src="https://img.shields.io/badge/linter-eslint-8080f2?style=flat-square&logo=eslint">
    </a>
    <a href="https://prettier.io/">
        <img alt="Code style Prettier" src="https://img.shields.io/badge/code%20style-prettier-f8bc45?style=flat-square&logo=prettier">
    </a>
    <img alt="Repository Top Language" src="https://img.shields.io/github/languages/top/privacy-scaling-explorations/p0tion?style=flat-square">
    </a>
</p>

<div align="center">
    <h4>
        <a href="/CONTRIBUTING.md">
            👥 Contributing
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="/CODE_OF_CONDUCT.md">
            🤝 Code of conduct
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="https://github.com/privacy-scaling-explorations/p0tion/contribute">
            🔎 Issues
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="/SECURITY.md">
            🔒 Security
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="https://discord.gg/sF5CT5rzrR">
            🗣️ Chat &amp; Support
        </a>
    </h4>
</div>
<br>

| p0tion has been intentionally designed as an agnostic-from-ceremony public good toolkit, with the aim of making Groth16 zk-applications scale and become production-ready in a safe and secure manner by running Phase 2 Trusted Setup ceremonies. |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

Our design philosophy ensures that p0tion stands as the optimal choice for running secure Groth16 zk-applications via automated phase2 ceremonies. The entire process has been streamlined through the easy to use and configure infrastructure, simplifying coordination, scalability, and minimizing the burden of conducting ceremonies from scratch. Additionally, our clear and user-friendly documentation and code, as well as rapid onboarding and deployment, guarantee an adaptable tool that can easily accommodate the evolving needs of developers.

## 📦 Packages

<table>
    <th>Package</th>
    <th>Version</th>
    <th>Downloads</th>
    <tbody>
       <tr>
            <td>
                <a href="/packages/actions">
                    @p0tion/actions
                </a>
            </td>
            <td>
                <!-- NPM version -->
                <a href="https://npmjs.org/package/@p0tion/actions">
                    <img src="https://img.shields.io/npm/v/@p0tion/actions.svg?style=flat-square" alt="NPM version" />
                </a>
            </td>
            <td>
                <!-- Downloads -->
                <a href="https://npmjs.org/package/@p0tion/actions">
                    <img src="https://img.shields.io/npm/dm/@p0tion/actions.svg?style=flat-square" alt="Downloads" />
                </a>
            </td>
        </tr>
       <tr>
            <td>
                <a href="/packages/backend">
                    @p0tion/backend
                </a>
            </td>
            <td>
                <!-- NPM version -->
                <a href="https://npmjs.org/package/@p0tion/backend">
                    <img src="https://img.shields.io/npm/v/@p0tion/backend.svg?style=flat-square" alt="NPM version" />
                </a>
            </td>
            <td>
                <!-- Downloads -->
                <a href="https://npmjs.org/package/@p0tion/backend">
                    <img src="https://img.shields.io/npm/dm/@p0tion/backend.svg?style=flat-square" alt="Downloads" />
                </a>
            </td>
        </tr>
       <tr>
            <td>
                <a href="/packages/phase2cli">
                    @p0tion/phase2cli
                </a>
            </td>
            <td>
                <!-- NPM version -->
                <a href="https://npmjs.org/package/@p0tion/phase2cli">
                    <img src="https://img.shields.io/npm/v/@p0tion/phase2cli.svg?style=flat-square" alt="NPM version" />
                </a>
            </td>
            <td>
                <!-- Downloads -->
                <a href="https://npmjs.org/package/@p0tion/phase2cli">
                    <img src="https://img.shields.io/npm/dm/@p0tion/phase2cli.svg?style=flat-square" alt="Downloads" />
                </a>
            </td>
        </tr>
    <tbody>

</table>

## 🛠 Installation

Clone this repository

```bash
git clone https://github.com/privacy-scaling-explorations/p0tion.git
```

Install the dependencies

```bash
cd p0tion && yarn
```

## 📜 Usage

Run [Rollup](https://www.rollupjs.org) to build all the packages

```bash
yarn build
```

### 🔎 Code Quality

Run [ESLint](https://eslint.org/) to analyze the code and catch bugs

```bash
yarn lint
```

Or to automatically lint the code

```bash
yarn lint:fix
```

Run [Prettier](https://prettier.io/) to check formatting rules

```bash
yarn prettier
```

Or to automatically format the code

```bash
yarn prettier:write
```

### 📝 Testing

For test execution (e2e/unit) we leverage [Jest](https://jestjs.io/).
#### Local Environment

**Prerequisites**

* Node.js version 16.0 or higher.
* Java JDK version 11 or higher.

The Java JDK is required in order to simulate the Firebase services by using the official Firebase Emulator. Note that the first run will result in a download of ~62 MB and no additional configuration is required.

Run Jest to execute (e2e/unit) tests on the emulator locally

```bash
yarn test
```
#### Production Environment

**Prerequisites**

* A Firebase Application w/ active billing (Blaze Plan) in order to support Cloud Functions deployment.
* Copy the `packages/actions/.env.default` file as `.env` `cp .env.default .env` and add your environment variables.
* Copy the `packages/backend/.default.env` file as `.env` `cp .default.env .env` and add your environment variables.
* Generate and store a configuration file with your service account's credentials as described in this [documentation](https://firebase.google.com/docs/admin/setup#set-up-project-and-service-account) inside the `packages/backend/serviceAccountKey.json` file.
* Navigate to the backend package by running `cd packages/backend`
* Rename the `.firebaserc` production project alias with your Firebase project name.
* Deploy your Firebase Application in production by running `yarn firebase:deploy` (this may take a while to propagate).

Run Jest to run (e2e/unit) tests in a production environment:

```bash
yarn test:prod
```

### ➕ Contributions

p0tion uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). The rules are enforced when running `git commit` or the [command line utility](https://github.com/commitizen/cz-cli) `yarn commit`.

The commands trigger a verification of changed files to check compliance with custom ESLint and Prettier rules.

<!-- ### Documentation (JS libraries) - soon

Run [TypeDoc](https://typedoc.org/) to generate a documentation website for each package

```bash
yarn docs
```

The output will be placed on the `docs` folder. -->

## License
This repository is released under the [MIT](https://github.com/privacy-scaling-explorations/p0tion/blob/main/LICENSE) License.
