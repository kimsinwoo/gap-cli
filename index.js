#!/usr/bin/env node

import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const FLAGS = new Set(['-b','--branch','-m','--message','-d','--debug','-e','--allow-empty']);

let branch = '', msg = '', debug = false, allowEmpty = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-b' || a === '--branch') { branch = argv[++i] || ''; continue; }
  if (a === '-m' || a === '--message') {
    const parts = [];
    for (let j = i + 1; j < argv.length; j++) {
      const t = argv[j]; if (FLAGS.has(t)) break; parts.push(t); i = j;
    }
    msg = parts.join(' '); continue;
  }
  if (a === '-d' || a === '--debug') { debug = true; continue; }
  if (a === '-e' || a === '--allow-empty') { allowEmpty = true; continue; }
}
if (!branch || !msg) {
  const pos = argv.filter(a => !a.startsWith('-'));
  if (!branch && pos[0]) branch = pos[0];
  if (!msg && pos.length > 1) msg = pos.slice(1).join(' ');
}
if (!branch || !msg) {
  console.error('사용법: gap -b <branch> -m "<commit message>"  또는  gap <branch> <commit message>');
  process.exit(1);
}

const sh  = (cmd, stdio = debug ? 'inherit' : 'pipe') => execSync(cmd, { stdio });
const ok  = (cmd) => { try { sh(cmd); return true; } catch { return false; } };
const out = (cmd) => { try { return execSync(cmd, { stdio: 'pipe' }).toString().trim(); } catch { return ''; } };

try {
  try { sh('git add .', 'inherit'); }
  catch (e) {
    console.error('현재 디렉토리가 Git 저장소가 아닙니다. (git init 후 다시 시도하세요)');
    process.exit(1);
  }

  sh('git rev-parse --is-inside-work-tree');
  sh('git fetch origin --prune');

  let base = 'main';
  const head = out('git symbolic-ref --short -q refs/remotes/origin/HEAD');
  if (head) base = head.split('/').pop();

  if (ok(`git show-ref --verify --quiet refs/heads/${branch}`)) {
    ok(`git switch ${branch}`) || sh(`git checkout ${branch}`);
  } else if (ok(`git ls-remote --exit-code --heads origin ${branch}`)) {
    ok(`git switch -t origin/${branch}`) || sh(`git checkout -t origin/${branch}`);
  } else {
    ok(`git switch ${base}`) || ok(`git switch -t origin/${base}`) || ok(`git checkout ${base}`) || ok(`git checkout -t origin/${base}`);
    ok(`git switch -c ${branch}`) || sh(`git checkout -b ${branch}`);
  }

  sh('git add -A');

  const changed = !ok('git diff --cached --quiet');
  const safeMsg = msg.replace(/"/g, '\\"');
  if (changed || allowEmpty) sh(`git commit ${allowEmpty ? '--allow-empty ' : ''}-m "${safeMsg}"`, 'inherit');

  sh(`git push -u origin ${branch}`, 'inherit');
  console.log(`✅ pushed to origin/${branch}`);
} catch (e) {
  const s = e?.stderr?.toString?.() || e?.message || String(e);
  console.error(s.trim());
  process.exit(e?.status || 1);
}
