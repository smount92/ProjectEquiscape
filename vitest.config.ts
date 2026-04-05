import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        exclude: ["node_modules", ".next", "e2e"],
        passWithNoTests: false,
        setupFiles: ["src/components/__tests__/setup.ts"],
        css: false, // Don't process CSS in tests
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/lib/**/*.ts"],
            exclude: [
                "src/lib/types/**",
                "src/lib/supabase/**",
            ],
            thresholds: {
                lines: 22,
                functions: 20,
                branches: 20,
                statements: 22,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
