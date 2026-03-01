# ⚡ SHG CLI

> A modern interactive CLI tool for Capacitor Android development — so you never have to remember those commands again.

```
███████╗██╗  ██╗ ██████╗
██╔════╝██║  ██║██╔════╝
███████╗███████║██║  ███╗
╚════██║██╔══██║██║   ██║
███████║██║  ██║╚██████╔╝
╚══════╝╚═╝  ╚═╝ ╚═════╝
```

## 📦 Installation

### Global install
```bash
npm install -g shg-cli
```

### Run instantly with npx
```bash
npx shg-cli
```

### Dev setup
```bash
git clone https://github.com/Diplovee/shg.git
cd shg/shg-cli
npm install
npm run build
npm link
```

Important:
- Run all package commands from `shg-cli/` (not the repo root).

## 💻 Local Use (No Publish)

Use this when you only want `shg` locally on your machine.

```bash
cd /home/diplov/shg/shg-cli
npm install
npm run build
npm link
shg
```

Rebuild after code changes:

```bash
cd /home/diplov/shg/shg-cli
npm run build
```

Remove local global link:

```bash
cd /home/diplov/shg/shg-cli
npm unlink -g shg-cli
```

## 🔄 Update Locally (after code changes)

Use this each time you want to refresh your local CLI install:

```bash
cd /home/diplov/shg/shg-cli
npm install
npm run build
npm link
hash -r
```

Verify:

```bash
which shg
shg --version
shg --help
```

## 🧯 Troubleshooting

`npm error Missing script: "build"`:
- You are likely in the wrong directory.
- Fix: `cd /home/diplov/shg/shg-cli`

`npm error Cannot destructure property 'name' of '.for' as it is undefined.` during `npm link`:
- Fallback install from the package folder:

```bash
cd /home/diplov/shg/shg-cli
npm install -g .
hash -r
```

If `shg` is still not found:
- Restart terminal, or run `hash -r` again.

## 🛠 Usage

```bash
shg
```

Check installed CLI version:

```bash
shg --version
```

Show help and flags:

```bash
shg --help
```

Requirements:
- Run in an interactive terminal (TTY).
- For `sync`, `run`, `update`, and `add android`, run from a Capacitor project root containing `capacitor.config.ts`, `capacitor.config.js`, or `capacitor.config.json`.

### 🚀 Build & Deploy
| Option | Command |
|---|---|
| Run ALL | `npm run build` → `npx cap sync android` → `npx cap run android` |
| Build only | `npm run build` |
| Sync only | `npx cap sync android` |
| Run only | `npx cap run android` |

### 🔧 Capacitor Setup
| Option | Command |
|---|---|
| Install Capacitor | `npm install @capacitor/core @capacitor/cli` |
| Init | `npx cap init` |
| Update | `npx cap update` |
| Add Android | `npx cap add android` |

## 🧰 Tech Stack

- [TypeScript](https://www.typescriptlang.org/)
- [Clack Prompts](https://github.com/natemoo-re/clack)
- [Chalk](https://github.com/chalk/chalk)
- [Figlet](https://github.com/patorjk/figlet.js)
- [Execa](https://github.com/sindresorhus/execa)

## 📁 Project Structure

```
shg-cli/
├── src/
│   └── index.ts
├── dist/
├── package.json
├── tsconfig.json
└── README.md
```

## 🚢 Publishing

```bash
npm login
npm version patch
npm publish --access public
```

## ✅ Quality Checks

```bash
npm run typecheck
npm run smoke
```

## 📝 Changelog

Release notes are tracked in `CHANGELOG.md`.

## 👤 Author

- Author: **SHG**
- Developer: **T-kay Tinotenda Mutumbiwenzou**
- Company context: **SHG** is a sub-company of **Xalo Software**.
