.PHONY: mock dev check test e2e perf

mock: ; pnpm run mock
dev: ; pnpm run dev
check: ; pnpm run check
test: ; pnpm run test
e2e: ; pnpm run e2e
perf: ; pnpm run perf