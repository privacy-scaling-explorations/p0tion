# MPC Phase2 Suite

The Multi-Party Computation suite of tools for conducting zkSNARK Phase 2 Trusted Setup ceremonies.

## Problem Statement

For production use, Groth16 zk-SNARK circuits require a MPC (Multi-Party Computation) Trusted Setup ceremony to generate the parameters that can kick-off zkSNARKs-based systems. Any Trusted Setup is organized in two subsequent steps: Phase 1 and Phase 2. The Phase 1 is universally reusable in any point of contribution as input for any zkSNARKs Phase 2 which must be done for each individual circuit.

The process of conducting Phase 1 and 2 is more or less similar. There always be a coordinator and multiple participants alternating in sequential rounds. Each participant performs one or more rounds at a time where the coordinator decides the order of the participants. Ipotetically, there can be an indefinite number of rounds, but at a certain point of time the ceremony ends and the proving/verifying keys are extracted for the specific circuit.

Basically, the ceremony starts when the coordinator generates and publish in a public accessible repository a challenge file. The first participant downloads the `challenge` file, generate some entropy (_toxic waste_), runs a computation to produce a response file. Then, the participant publish the contribution file and notifies the coordinator. After that, the coordinator produces a `new_challenge` file based on the first participant contribution result and pass the baton to the next participant. The process repeats indefinitely until the coordinator decides to stop the ceremony.

The go-to goal of the ceremony is to have at least one party behaving honestly, because as long as he/she is not compromised (i.e., discards the toxic waste), the entire ceremony must be considered trustworthy. This is one of the main reasons why we need a trusted MPC setup: as the number of participants increases, the more you can be sure that at least one is honest! 😇

In last few years different ceremonies have been performed with different tools that automate processes and simplify ceremony coordination and verification. Previous ceremonies were conducted mainly in browser-based ecosystems,taking advantage of third-party services for authentication and hosted DB solutions to get rid of the Coordinator role. Despite this, circuits are now becoming larger and larger in size. Therefore, the key issue lies in the different configurations with several orders of magnitude in size (i.e., constraints) of the circuits. In fact, some new versions of protocols (e.g., MACI) easily exceed one million constraints per circuit for different input variations.

Consequently, Our solution attempts to be a ready-to-use solution for performing a single ceremony for multiple large circuits in a non browser-based environment while maintaining all the advantages in terms of simplicity and coordination automation.

## Architecture

The idea is to have a NodeJS CLI published as NPM package and use Firebase Cloud services (Authentication, Storage, DB and Functions) to automate and coordinate the ceremony with proper built-in custom scripts.

![alt text](https://i.imgur.com/CqYHWto.jpg)

### Actors

-   **Coordinator**: an individual responsible for conducting and monitoring the ceremony. Basically, the coordinator have to prepare and conduct each step of the Phase 2 ceremony, from beginning to end.
-   **Participant**: an individual who wants to contribute to the ceremony. The participant computes the contribution locally on their machine, generates an attestation, and makes it publicly available to everyone.

### Components

-   **phase2cli**: all-in-one command-line for interfacing with zkSNARK Phase 2 Trusted Setup ceremonies. Both the participant and the coordinator can use it to interact with the ceremony, from its setup to generating a contribution.
-   **firebase**: 3rd party Firebase CLI tool used to bootstrap the project to the cloud, locally emulate functions, db, storage and rules.

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

### Usage

Run tests

```bash
yarn test
# or
yarn test:watch
```

Lint the TypeScript code:

```bash
yarn lint
# with fix
yarn lint:fix
```

And check if the code is well formatted:

```bash
yarn prettier
# with fix
yarn prettier:fix
```

## ⚠️ 🛠 The project is a WIP, so it is not yet to be considered production ready. Handle with care 😴

What's missing

-   Code of conduct
-   Contributing
-   Support

**Please, follow the project boards to stay up-to-date!**
