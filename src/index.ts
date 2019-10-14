import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import crypto from 'crypto';
import { interval, from } from 'rxjs';
import { mergeMap, startWith } from 'rxjs/operators';
import { ExecOptions, spawn } from 'child_process';
import config from '../config.json';

const fsExistsAsync = promisify(fs.exists);
const fsMkDirAsync = promisify(fs.mkdir);

class CommandError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

const spawnAsync = (
  command: string,
  args: ReadonlyArray<string>,
  options?: ExecOptions,
) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('close', code => {
      if (code) {
        reject(
          new CommandError(
            code,
            `command: "${command}" with args: [${args.join(
              ', ',
            )}] failed with error code ${code}`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
};

const cleanRepoFolder = async (localRepositoryDirectory: string) => {
  console.log('clean repository folder');
  if (await fsExistsAsync(localRepositoryDirectory)) {
    await spawnAsync('rm', ['-rf', localRepositoryDirectory], {
      cwd: process.cwd(),
    });
  }
};

const cloneRepo = async (
  localRepositoryDirectory: string,
  sourceUrl: string,
) => {
  console.log('clone source repository');
  await fsMkDirAsync(localRepositoryDirectory, { recursive: true });
  await spawnAsync(
    'git',
    ['clone', '--mirror', sourceUrl, localRepositoryDirectory],
    { cwd: process.cwd() },
  );
};

const setMirrorPushTarget = async (
  localRepositoryDirectory: string,
  targetUrl: string,
) => {
  console.log('add mirror target to push', targetUrl);
  await spawnAsync('git', ['remote', 'set-url', '--push origin', targetUrl], {
    cwd: localRepositoryDirectory,
  });
};
const setupRepositoryFolder = async (
  localRepositoryDirectory: string,
  sourceUrl: string,
  targetUrl: string,
) => {
  await cleanRepoFolder(localRepositoryDirectory);
  await cloneRepo(localRepositoryDirectory, sourceUrl);
  await setMirrorPushTarget(localRepositoryDirectory, targetUrl);
};

const startRepoSync = async (sourceUrl: string, targetUrl: string) => {
  console.log('starting git sync for ', sourceUrl, 'to ', targetUrl);
  const repoHash = crypto
    .createHash('md5')
    .update(`${sourceUrl}->${targetUrl}`)
    .digest('hex')
    .toString();

  const localRepositoryDirectory = path.join(process.cwd(), 'repos', repoHash);

  if (
    config.cleanRepoOnRun ||
    !(await fsExistsAsync(localRepositoryDirectory))
  ) {
    await setupRepositoryFolder(localRepositoryDirectory, sourceUrl, targetUrl);
  }

  (config.onlyRunOnce
    ? from([0])
    : interval(config.syncIntervalSeconds * 1000).pipe(startWith(0))
  )
    .pipe(
      mergeMap(async () => {
        console.log('fetch updates from', sourceUrl);
        await spawnAsync('git', ['fetch', '-p', 'origin'], {
          cwd: localRepositoryDirectory,
        });
      }),
      mergeMap(async () => {
        console.log('push updates to', targetUrl);
        await spawnAsync('git', ['push', '--mirror', '--force'], {
          cwd: localRepositoryDirectory,
        });
      }),
    )
    .subscribe();
};

config.syncRepositories.forEach(({ source, target }) => {
  startRepoSync(source, target);
});
