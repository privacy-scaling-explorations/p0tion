<p align="center">
    <h1 align="center">
        Actions 🌵
    </h1>
    <p align="center">A core library toolbox for easy back/front-end integration.</p>
</p>

<p align="center">
    <a href="https://github.com/privacy-scaling-explorations/p0tion">
        <img src="https://img.shields.io/badge/project-p0tion-blue.svg?style=flat-square">
    </a>
    <a href="https://github.com/privacy-scaling-explorations/p0tion/blob/main/LICENSE">
        <img alt="Github License" src="https://img.shields.io/github/license/privacy-scaling-explorations/p0tion.svg?style=flat-square">
    </a>
    <a href="https://www.npmjs.com/package/@p0tion/actions">
        <img alt="NPM Version" src="https://img.shields.io/npm/v/@p0tion/actions?style=flat-square" />
    </a>
    <a href="https://npmjs.org/package/@p0tion/actions">
        <img alt="Downloads" src="https://img.shields.io/npm/dm/@p0tion/actions.svg?style=flat-square" />
    </a>
    <a href="https://eslint.org/">
        <img alt="Linter" src="https://img.shields.io/badge/linter-eslint-8080f2?style=flat-square&logo=eslint" />
    </a>
    <a href="https://prettier.io/">
        <img alt="Prettier" src="https://img.shields.io/badge/code%20style-prettier-f8bc45?style=flat-square&logo=prettier" />
    </a>
</p>

<div align="center">
    <h4>
        <a href="https://github.com/privacy-scaling-explorations/p0tion/blob/main/CONTRIBUTING.md">
            👥 Contributing
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="https://github.com/privacy-scaling-explorations/p0tion/blob/main/CODE_OF_CONDUCT.md">
            🤝 Code of conduct
        </a>
        <span>&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="https://discord.gg/sF5CT5rzrR">
            🗣️ Chat &amp; Support
        </a>
    </h4>
</div>

| This library contains a collection of methods, types, and constants relevant to p0tion's core workflow which are totally reusable and extensible when integrating into a backend or frontend. |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

To integrate these features, you only need to install the package and import methods, types, or constants according to your own requirements. If you wish to extend one or more features, you can create them on top of these. To further extend the package, you can fork the project and/or submit a PR containing the updates.

## 🛠 Installation

### NPM or Yarn

Install the `@p0tion/actions` package with npm

```bash
npm i @p0tion/actions
```

or yarn

```bash
yarn add @p0tion/actions
```

## 📜 Usage

### Local Development

**Prerequisites**

* Node.js version 16.0 or higher.
* Yarn version 3.5.0 or higher.

Copy the `.env.default` file as `.env`:

```bash
cp .env.default .env
```

And add your environment variables.

⚠️ Your environment variables must match the corresponding properties values inside the `.env` file of the `phase2cli` package ⚠️
