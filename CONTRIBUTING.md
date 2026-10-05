# Contributing to Beidar

We welcome contributions! Please follow these steps to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Setup

The project uses Go (Backend) and React (Frontend).
Ensure you follow the architecture guidelines detailed in [`AGENTS.md`](AGENTS.md), the domain rules in [`.agents/rules/`](.agents/rules), and [`docs/`](docs).

## Development Governance (إلزامي)

- اقرأ [`AGENTS.md`](AGENTS.md) و[`docs/DOCUMENTATION_MAP.md`](docs/DOCUMENTATION_MAP.md) قبل أي عمل.
- حدّث `CHANGELOG.md` تحت `[Unreleased]` وكل مستند يفرضه تغييرك وفق مصفوفة المزامنة.
- قبل الكومت: `node scripts/docs-gate.mjs --strict-refs` (مفروض آلياً عبر `frontend/.husky/pre-commit`).
- قبل الدفع: `node scripts/docs-gate.mjs --push` (مفروض آلياً عبر `frontend/.husky/pre-push` ووظيفة `docs-gate` في CI).
- Builds are produced only via `pwsh ./scripts/build.ps1` — never run `wails build` directly.

## Reporting Issues

If you find a bug, please create an issue detailing the steps to reproduce it.
