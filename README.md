# 🧠 gap-cli — Git 자동 커밋·푸시 도구

**gap-cli**는 브랜치 생성, 커밋, 푸시를 한 번에 처리하는 간단한 **Git 자동화 CLI**입니다.  
복잡한 명령 없이, 한 줄로 `gap main "feat: 초기 설정"`처럼 바로 푸시할 수 있습니다.

---

## ⚙️ Requirements

- **Node.js** ≥ 18 (LTS 권장)
- **Git** ≥ 2.20
- 원격 저장소(`origin`)가 설정된 Git 레포지토리 (예: `https://github.com/user/repo.git`)

---

## 📦 Installation

### 🔸 전역 설치

```bash
npm install -g gap-cli
```

### 🔸 설치 없이 1회성 실행

```bash
npx -y gap-cli <branch> <commit message...>
```

---

## 💻 Usage

### 기본 사용법

```bash
gap <branch> <commit message...>
```

또는

```bash
gap -b <branch> -m "<commit message>"
```

---

## ⚙️ Options

| 옵션 | 설명 |
|------|------|
| `-b, --branch <name>` | 대상 브랜치 이름 지정 |
| `-m, --message <msg>` | 커밋 메시지 지정 (따옴표 생략 가능) |
| `-e, --allow-empty` | 변경사항이 없어도 커밋 허용 |
| `-d, --debug` | 실행되는 Git 명령어를 실시간으로 출력 |

---

## 🔄 동작 순서

1. `git add .`  
2. `git fetch origin --prune`  
3. 기본 브랜치(`origin/HEAD` → `main`) 자동 추론  
4. 브랜치 존재 여부 확인  
   - 로컬 존재 → `git switch`  
   - 원격만 존재 → `git switch -t origin/<branch>`  
   - 둘 다 없음 → 기본 브랜치에서 새 브랜치 생성  
5. 변경사항 스테이징 (`git add -A`)  
6. 변경이 있거나 `--allow-empty` 옵션 시 커밋  
7. `git push -u origin <branch>`

> 💡 메시지에 큰따옴표(`"`)가 포함되어도 자동 이스케이프 처리됩니다.

---

## 🧩 Examples

```bash
# 1️⃣ 메시지 따옴표 없이 간단 커밋
gap main feat: 초기 설정

# 2️⃣ 옵션 지정 방식
gap -b feature/api -m "feat: 로그인 API 추가"

# 3️⃣ 변경이 없어도 커밋
gap release "chore: trigger ci" -e

# 4️⃣ 디버그 모드 실행
gap hotfix/login "fix: null 체크" -d
```

---

## ⚡ Direct Usage (npx)

```bash
npx -y gap-cli main "feat: 첫 커밋"
```

---

## 🧠 Troubleshooting

| 문제 상황 | 해결 방법 |
|------------|------------|
| 🚫 현재 디렉토리가 Git 레포가 아님 | `git init && git remote add origin <repo-url>` 실행 후 재시도 |
| 🔒 원격(origin) 없음 또는 권한 오류 | SSH 키 또는 액세스 토큰 권한 확인 |
| 🔄 기본 브랜치가 `main`이 아님 | `git remote set-head origin -a` 실행으로 기본 브랜치 동기화 |
| ⚠️ PowerShell에서 특수문자 포함 메시지 문제 | 따옴표 없이 작동하지만 필요 시 `"메시지"`로 감싸 실행 |

---

## 📜 gap-cli 사용법 (요약)

```html
<h2>gap-cli 사용법</h2>
<ol>
  <li>npm i -g gap-cli</li>
  <li>npx -y gap-cli 브랜치명 "커밋 내용"</li>
</ol>
```

---

## 📄 실행 코드

아래는 gap-cli의 실제 Node.js 실행 파일입니다.

```js
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
  console.log(`pushed to origin/${branch}`);
} catch (e) {
  const s = e?.stderr?.toString?.() || e?.message || String(e);
  console.error(s.trim());
  process.exit(e?.status || 1);
}
```
