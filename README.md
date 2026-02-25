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
git clone https://github.com/Diplovee/shg-cli.git
cd shg-cli
npm install
npm run build
npm link
```

## 🛠 Usage

```bash
shg
```

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

## 👤 Author

Built by **SHG** — because life's too short to remember CLI commands.
