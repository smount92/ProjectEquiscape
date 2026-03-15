type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, context: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${context}]`;

    switch (level) {
        case "error":
            console.error(`${prefix} ${message}`, data ?? "");
            break;
        case "warn":
            console.warn(`${prefix} ${message}`, data ?? "");
            break;
        default:
            if (process.env.NODE_ENV !== "production") {
                console.log(`${prefix} ${message}`, data ?? "");
            }
    }
}

export const logger = {
    info: (ctx: string, msg: string, data?: unknown) => log("info", ctx, msg, data),
    warn: (ctx: string, msg: string, data?: unknown) => log("warn", ctx, msg, data),
    error: (ctx: string, msg: string, data?: unknown) => log("error", ctx, msg, data),
};
