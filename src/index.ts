import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import crypto from 'crypto';
import { interval, from } from 'rxjs';
import { mergeMap, startWith, switchMapTo } from 'rxjs/operators';
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

const startRepoSync = (sourceUrl: string, targetUrl: string) => {
  console.log('starting git sync for ', sourceUrl, 'to ', targetUrl);
  const sourceUrlHash = crypto
    .createHash('md5')
    .update(sourceUrl)
    .digest('hex')
    .toString();

  const localRepositoryDirectory = path.join(
    process.cwd(),
    'repos',
    sourceUrlHash,
  );

  from(cleanRepoFolder(localRepositoryDirectory))
    .pipe(
      mergeMap(async () => {
        console.log('clone source repository');
        await fsMkDirAsync(localRepositoryDirectory, { recursive: true });
        await spawnAsync(
          'git',
          ['clone', '--mirror', sourceUrl, localRepositoryDirectory],
          { cwd: process.cwd() },
        );
      }),
      mergeMap(async () => {
        console.log('add mirror target to push', targetUrl);
        await spawnAsync(
          'git',
          ['remote', 'set-url', '--push origin', targetUrl],
          {
            cwd: localRepositoryDirectory,
          },
        );
      }),
      switchMapTo(
        interval(config.syncIntervalSeconds * 1000).pipe(startWith(0)),
      ),
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
