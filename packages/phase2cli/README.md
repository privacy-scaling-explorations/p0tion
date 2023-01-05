<p align="center">
    <h1 align="center">
        MPC Phase2 Suite CLI
    </h1>
    <p align="center">All-in-one command-line for interfacing with zkSNARK Phase 2 Trusted Setup ceremonies</p>
</p>

<p align="center">
    <a href="https://github.com/quadratic-funding/mpc-phase2-suite" target="_blank">
        <img src="https://img.shields.io/badge/project-mpc--phase2--suite-blue">
    </a>
    <a href="https://eslint.org/" target="_blank">
        <img alt="Linter eslint" src="https://img.shields.io/badge/linter-eslint-8080f2?style=flat-square&logo=eslint">
    </a>
    <a href="https://prettier.io/" target="_blank">
        <img alt="Code style prettier" src="https://img.shields.io/badge/code%20style-prettier-f8bc45?style=flat-square&logo=prettier">
    </a>
    <img alt="Repository top language" src="https://img.shields.io/github/languages/top/quadratic-funding/mpc-phase2-suite?style=flat-square">
</p>

<div align="center">
    <h4>
        <a href="#">
            👥 Contributing (WIP)
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="#">
            🤝 Code of conduct (WIP)
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="#">
            🗣️ Chat &amp; Support (WIP)
        </a>
    </h4>
</div>

---

## Commands

-   `phase2cli`: CLI entry point.
-   `phase2cli auth`: Starts the Device Flow authentication workflow for Github OAuth 2.0.
-   `phase2cli contribute`: Allow a user to participate by computing a contribution for each circuit of a selected ceremony (from those currently running).
-   `phase2cli coordinate setup`: Allow the coordinator to setup a new ceremony for a particular set/variants of circuits.
-   `phase2cli coordinate observe`: Allow the coordinator to monitor in real-time who is currently contributing for a circuit of a ceremony.

## Getting Started

### Prerequisities

You need to have the following installed:

git >= 2.25.1
node >= 16.14.0
npm >= 8.9.0
yarn >= 1.22.18

### Configuration

Clone the repository and install the packages:

```
https://github.com/quadratic-funding/mpc-phase2-suite
cd mpc-phase2-suite
yarn
```

Navigate to the `phase2cli/` folder and make a copy of the .env.json.default file and rename it .env.json. The new file will contain the following data:

```json
{
    "firebase": {
        "FIREBASE_API_KEY": "your-firebase-api-key",
        "FIREBASE_AUTH_DOMAIN": "your-firebase-auth-domain",
        "FIREBASE_PROJECT_ID": "your-firebase-project-id",
        "FIREBASE_MESSAGING_SENDER_ID": "your-firebase-messaging-sender-id",
        "FIREBASE_APP_ID": "your-firebase-app-id"
    },
    "github": {
        "GITHUB_CLIENT_ID": "your-github-oauth-app-client-id"
    }
}
```

-   The `firebase` object contains your Firebase Application configuration.
-   The `github` object contains your Github OAuth Application client identifier.

### Usage

#### Local Development

Build the project

```bash
yarn build
```

Authenticate using Github OAuth (auth command).

```bash
yarn auth
```

Contribute to a ceremony (contribute command).

```bash
yarn contribute
```

Setup a new ceremony (setup command).

```bash
yarn coordinate:setup
```

Observe contributions for a ceremony (observe command).

```bash
yarn coordinate:observe
```

#### NPM Package

You could locally install the CLI as NPM package

```bash
npm i -g
```

Then, you could have access to `phase2cli` commands (as described above).

## ⚠️ 🛠 The project is a WIP, so it is not yet to be considered production ready. Handle with care 😴

**Please, follow the project boards to stay up-to-date!**
