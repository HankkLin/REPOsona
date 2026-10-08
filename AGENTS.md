# AGENTS.md

This file provides instructions for AI coding agents working in this repository, including OpenAI Codex, Claude Code, and similar tools.

## Project Overview
This project turns GitHub repositories into interactive avatars. Each repository is represented as a distinct persona whose knowledge is grounded in the repository's README, documentation, issues, pull requests, commit history, and codebase. The avatar should explain not only how the repository works, but also its design philosophy, conventions, boundaries, and historical decisions.
The system may infer a repository-specific “Repo DNA” containing traits such as communication style, technical philosophy, stability preference, strictness, and community culture. These traits should influence how the avatar speaks without overriding factual grounding.
The core product goal is to make interacting with a repository feel like speaking with the repository itself, rather than using a generic documentation chatbot.
Key product concepts include:
- Repo Avatar: one interactive avatar per GitHub repository
- Repo DNA: inferred personality and communication style
- Repo Convictions: what the project deliberately supports, rejects, or considers out of scope
- Grounded Q&A: answers sourced from repository content
- Repo Council: multiple repository avatars discussing compatibility, architecture, and responsibility for a user-defined system
Avatar personality must never fabricate repository facts. Factual accuracy and traceability take priority over characterization.


## Required AI Providers

- Reactor is required for avatar rendering and animation. Documentation: https://docs.reactor.inc/llms.txt. Verify model capabilities against official documentation.
- All other application AI models must be Google models. Use Gemini Flash for persona generation and everyday answers, Gemini Pro for explicitly selected deeper reasoning, Google text embeddings for repository-scoped retrieval, Gemini TTS for read-aloud speech, and Nano Banana for avatar images.
- Do not add non-Google AI providers or automatic fallbacks unless the user explicitly changes this requirement.
- Every repository avatar keeps a separate knowledge base and stable voice/personality. Retrieved repository evidence supplies facts; persona instructions supply style.
- Keep exact model IDs configurable and verify them against Google's official model catalog. Credentials must remain server-side and excluded from Git.
- LTX currently takes an image and a script and produces its own synchronized voice/video. Do not claim that Gemini TTS can drive its lips: no external-audio input is documented. Gemini TTS is the separate read-aloud path until Reactor supports a verified audio-driven avatar integration.
- Use stock voices initially; do not assume or introduce voice cloning. Browser speech is permitted only in the explicitly labeled demo and is not a live-model fallback.

Before making changes, inspect the repository and determine:

- What the project does
- Primary programming languages
- Frameworks and major libraries
- Application entry points
- Build system
- Package manager
- Test framework
- Linting and formatting tools
- Deployment environment
- Important configuration files
- Existing architectural conventions

Do not assume these details. Infer them from the repository.

Useful files to inspect first include:

```text
README.md
package.json
pyproject.toml
requirements.txt
Cargo.toml
go.mod
pom.xml
build.gradle
Makefile
Dockerfile
docker-compose.yml
.github/
src/
app/
tests/
docs/
```

Only inspect files that actually exist.

---

# Repository Initialization

When first entering this repository, perform the following sequence.

## 1. Understand the repository

Inspect the top-level directory structure.

Identify:

```text
Application entry points
Core modules
API routes
Frontend components
Backend services
Database layer
Models and schemas
Configuration
Tests
Scripts
Documentation
```

Read `README.md` and any architecture documentation before modifying code.

If documentation and implementation disagree, treat the implementation as the current source of truth and mention the discrepancy.

## 2. Determine how the project runs

Identify the correct commands for:

```text
install
development
build
test
lint
format
type-check
```

Prefer commands already defined by the project rather than inventing new ones.

Examples:

```bash
npm install
npm run dev
npm test
npm run lint

pnpm install
pnpm dev

uv sync
pytest
ruff check .

pip install -r requirements.txt
python -m pytest

cargo build
cargo test

go test ./...
```

Do not execute destructive, deployment, migration, or production commands unless explicitly requested.

## 3. Inspect local conventions

Before writing new code, inspect nearby files and follow existing conventions for:

- Naming
- File structure
- Imports
- Error handling
- Logging
- Type annotations
- Component patterns
- API design
- State management
- Tests
- Documentation

Prefer consistency with the repository over generic best practices.

---

# Working Principles

## Understand before editing

Before implementing a change:

1. Locate the relevant code.
2. Trace how it is called.
3. Identify dependent modules.
4. Inspect related tests.
5. Determine whether the requested behavior already partially exists.

Do not create duplicate implementations when an existing abstraction can be extended.

## Keep changes scoped

Make the smallest coherent change that solves the task.

Avoid unrelated:

- Refactors
- Dependency upgrades
- Formatting changes
- Renames
- File moves
- API redesigns

unless they are necessary for the requested work.

## Preserve existing behavior

Assume existing public behavior is intentional unless the task explicitly requires changing it.

Be particularly careful with:

- Public APIs
- Database schemas
- Configuration formats
- Environment variables
- CLI arguments
- Serialized data
- Authentication
- Authorization
- External integrations

---

# Architecture

Respect the repository's existing architectural boundaries.

Typical boundaries may include:

```text
UI
Controllers / Routes
Services
Domain logic
Data access
Database
External integrations
Utilities
```

Do not move logic between layers without a clear reason.

Prefer putting business logic in reusable modules rather than embedding it directly in UI components or route handlers.

When adding functionality, first determine which existing module logically owns it.

---

# Code Quality

Write code that is:

- Clear
- Minimal
- Maintainable
- Typed where the project supports typing
- Consistent with nearby code
- Easy to test

Prefer readable code over clever code.

Avoid unnecessary abstraction.

Do not introduce a helper, class, service, or dependency unless it reduces meaningful duplication or complexity.

---

# Dependencies

Do not add a new dependency unless:

1. Existing dependencies cannot reasonably solve the problem.
2. The dependency provides substantial value.
3. It is actively maintained and appropriate for the project.

Before adding one, inspect whether an equivalent package already exists in the dependency tree.

Never replace the project's package manager.

Examples:

```text
package-lock.json -> npm
pnpm-lock.yaml -> pnpm
yarn.lock -> yarn
uv.lock -> uv
poetry.lock -> Poetry
Cargo.lock -> Cargo
```

Preserve the existing lockfile strategy.

---

# Testing

Any meaningful behavior change should include or update tests when practical.

Before finishing:

1. Run the most relevant tests.
2. Run broader tests if reasonably inexpensive.
3. Run linting or type checks relevant to changed files.
4. Report anything that could not be run.

Prefer focused tests during development.

Example:

```bash
pytest tests/test_feature.py
```

before:

```bash
pytest
```

For bug fixes, add a regression test when possible.

A good regression test should:

1. Fail before the fix.
2. Pass after the fix.
3. Describe the intended behavior.

Do not delete or weaken tests merely to make a change pass.

---

# Validation

After making changes, check:

```text
Does the project compile or build?
Do relevant tests pass?
Does linting pass?
Does type checking pass?
Did imports remain valid?
Did configuration remain valid?
Did the change introduce unused code?
```

If full validation is not possible, clearly state what was and was not verified.

---

# Git Practices

Do not modify unrelated files.

Before completing work, review the diff.

Pay attention to accidental changes involving:

```text
lockfiles
generated files
build artifacts
IDE settings
environment files
large binaries
```

Do not commit secrets.

Never add:

```text
.env
API keys
access tokens
passwords
private keys
credentials
```

unless the repository intentionally contains safe example values.

Use `.env.example` or equivalent for placeholder configuration.

---

# Existing User Changes

Assume uncommitted changes may belong to the user.

Do not:

- Reset them

---

# UI Skills

`.claude/skills/` vendors Emil Kowalski's design-engineering skills (MIT, [emilkowalski/skills](https://github.com/emilkowalski/skills) @ `e8a175d`). Use them for frontend work:

- `emil-design-eng`: UI polish, easing, durations, press feedback
- `review-animations`, `improve-animations`, `find-animation-opportunities`, `animate`, `animation-vocabulary`: motion
- `mobile-native`: touch, safe areas, input zoom
- `break-ui`: worst-case data stress tests
- `apple-design`, `prototype`, `pick-ui-library`, `ask-sonner`: design direction and libraries

The React Native and Swift skills are omitted because this project does not use them.
