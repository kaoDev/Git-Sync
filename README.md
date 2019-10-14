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
- start sync process with the command `yarn start`

## configuration

- `onlyRunOnce` (`true`), makes sure that the program doesn't schedule further
  updates, so the `interval` setting is ignored. If you are running this program
  as a scheduled job make sure to set this flag to `true`
- `cleanRepoOnRun` (`false`), flag to indicate if the cloned repository
  directory should cleaned before every run
- `syncIntervalSeconds` (`60`), interval in seconds in which the source
  repository should get pulled and updates should be pushed to the target.
  Ignored if `onlyRunOnce` is set to `true`
