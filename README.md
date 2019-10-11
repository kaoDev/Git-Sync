# git sync

a small tool to sync a git repository to a mirrored location

## requirements

- a current node installation (>=v10) (https://nodejs.org/en/)
- yarn (https://yarnpkg.com/lang/en/docs/install)
- git client (https://git-scm.com/downloads)
- registered ssh key with read permissions on source repository
- registered ssh key with push permissions on target repository

## usage

- install dependencies with `yarn install`
- configure repositories to sync in `./config.json`
- configure sync interval in `./config.json`
- start sync process with the command `yarn start`
