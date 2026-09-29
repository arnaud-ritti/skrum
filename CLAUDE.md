# skrum

## Workflow: Spec-Driven Development (SDD)

Every feature or behavior change follows this order. No code before an approved spec.

1. **Brainstorm** requirements (`superpowers:brainstorming`).
2. **Spec** — write it with explicit acceptance criteria; get user approval.
3. **Plan** — derive an implementation plan from the spec (`superpowers:writing-plans`).
4. **Implement** against the spec using TDD (`superpowers:test-driven-development`).
5. **Verify** every acceptance criterion before claiming done (`superpowers:verification-before-completion`).

If implementation reveals the spec is wrong or incomplete, update the spec first, then the code.
