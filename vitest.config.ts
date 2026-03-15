import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        exclude: ["node_modules", ".next", "e2e"],
        passWithNoTests: false,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/lib/**/*.ts"],
            exclude: ["src/lib/types/**", "src/lib/supabase/**"],
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
