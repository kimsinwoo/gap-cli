#!/usr/bin/env node
// index.js (Node 18+; package.json에 "type":"module" 권장)
import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const getFlag = (name, alias) => {
  const i = argv.findIndex(a => a === `--${name}` || a === `-${alias}`);
  return i !== -1 ? argv[i + 1] : null;
};
const hasFlag = (name, alias) => argv.includes(`--${name}`) || argv.includes(`-${alias}`);

let branch = getFlag('branch', 'b');
let msg = getFlag('message', 'm');
const debug = hasFlag('debug', 'd');
const allowEmpty = hasFlag('allow-empty', 'e');

// 위치 인자 fallback: gap-cli <branch> "<message...>"
if (!branch && argv.length >= 2) {
  branch = argv[0];
  msg = argv.slice(1).join(' ');
}

if (!branch || !msg) {
  console.error('사용법: gap-cli -b <branch> -m "<commit message>" [--allow-empty] [--debug]');
  console.error('또는:   gap-cli <branch> "<commit message>"');
  process.exit(1);
}

const run = (cmd) => {
  if (debug) console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: debug ? 'inherit' : 'pipe' });
};
const tryRun = (cmd) => {
  try { return run(cmd), true; } catch { return false; }
};
const out = (cmd) => {
  if (debug) console.log(`$ ${cmd}`);
  try { return execSync(cmd, { stdio: 'pipe' }).toString().trim(); } catch { return ''; }
};

try {
  run('git rev-parse --is-inside-work-tree');

  // 기본 브랜치 탐지: origin/HEAD -> main|master
  run('git fetch origin --prune');
  let base = 'main';
  const headRef = out('git symbolic-ref --quiet refs/remotes/origin/HEAD'); // ex) refs/remotes/origin/main
  if (headRef) base = headRef.split('/').pop();       // "main" 또는 "master"

  // 1) 로컬 브랜치 있으면 그대로 체크아웃
  if (tryRun(`git show-ref --verify --quiet refs/heads/${branch}`)) {
    run(`git checkout ${branch}`);
  } else {
    // 2) 원격 브랜치 있으면 트래킹 체크아웃
    if (tryRun(`git ls-remote --exit-code --heads origin ${branch}`)) {
      run(`git switch -t origin/${branch}`);
    } else {
      // 3) 기본 브랜치로 이동(로컬/원격)
      if (!tryRun(`git switch ${base}`)) {
        tryRun(`git switch -t origin/${base}`); // 원격 기본 브랜치 트래킹
      }
      // 4) 새 브랜치 생성
      run(`git switch -c ${branch}`);
    }
  }

  // 스테이징 & 커밋
  run('git add -A');

  // 변경 여부 판단
  let hasChanges = true;
  try { execSync('git diff --cached --quiet', { stdio: 'pipe' }); hasChanges = false; } catch { hasChanges = true; }

  const quoted = msg.replace(/"/g, '\\"');
  if (hasChanges || allowEmpty) {
    run(`git commit ${allowEmpty ? '--allow-empty ' : ''}-m "${quoted}"`);
  } else if (debug) {
    console.log('변경 사항이 없어 커밋을 건너뜁니다. (--allow-empty 로 강제 가능)');
  }

  run(`git push -u origin ${branch}`);
  console.log(`✅ pushed to origin/${branch}`);
} catch (e) {
  if (e?.stderr) console.error(e.stderr.toString());
  process.exit(e.status || 1);
}
