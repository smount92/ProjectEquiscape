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
            include: ["src/lib/**/*.ts", "src/components/**/*.tsx"],
            exclude: [
                "src/lib/types/**",
                "src/lib/supabase/**",
                "src/components/__tests__/**",
            ],
            thresholds: {
                lines: 37,
                functions: 37,
                branches: 37,
                statements: 37,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
