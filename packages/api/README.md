## Description

A backend server that host all p0tion functionalities to coordinate a ceremony. Built with [Nest](https://github.com/nestjs/nest) framework.

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Add new modules

If you don't have the Nest CLI installed and you don't want to install it globally, you can use the following command to create a new module:

```bash
$ npx @nestjs/cli@latest generate module users

$ npx @nestjs/cli@latest generate controller /users/controller/users --flat

$ npx @nestjs/cli@latest generate service /users/service/users --flat

$ npx @nestjs/cli@latest generate class /users/dto/usersDto --flat
```
