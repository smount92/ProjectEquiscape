/**
 * "Copy as ticket" (MHH-028): any report becomes the one backlog command the
 * ticket skill uses, safe to paste into a shell, with no personal data.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { labelForContactCategory, scrubForTicket, shellQuote, ticketCommand } from "@/lib/admin/ticketDraft";

describe("scrubForTicket", () => {
    it("blanks emails and phone numbers", () => {
        expect(scrubForTicket("Write me at pat.smith@example.com or +1 (555) 123-4567 please")).toBe(
            "Write me at [email removed] or [number removed] please",
        );
    });

    it("squashes whitespace and caps the length", () => {
        expect(scrubForTicket("a\n\n  b", 10)).toBe("a b");
        expect(scrubForTicket("x".repeat(50), 10)).toBe(`${"x".repeat(9)}…`);
    });
});

describe("shellQuote", () => {
    it("survives quotes, dollars and backticks in a real shell", () => {
        const nasty = `It's "$HOME" and \`rm -rf\` $(whoami)`;
        let echoed: string;
        try {
            echoed = execFileSync("sh", ["-c", `printf %s ${shellQuote(nasty)}`], { encoding: "utf8" });
        } catch {
            // No POSIX shell on this machine: check the shape instead.
            expect(shellQuote(nasty)).toBe(`'It'"'"'s "$HOME" and \`rm -rf\` $(whoami)'`);
            return;
        }
        expect(echoed).toBe(nasty);
    });
});

describe("ticketCommand", () => {
    it("builds the ticket skill's command: title, type, labels, priority, Later, Why/Source, criteria", () => {
        const cmd = ticketCommand({
            title: "Search can't find Bramble",
            type: "bug",
            labels: ["registry", "member-reported", "registry"],
            why: "I searched for Bramble and got nothing. Email me: pat@example.com",
            source: "Admin › Mailbox, @Pat, 2026-10-15",
        });
        expect(cmd.startsWith(`backlog task create 'Search can'"'"'t find Bramble' --type bug`)).toBe(true);
        expect(cmd).toContain("-l registry,member-reported --priority medium -m 'Later'");
        expect(cmd).toContain("**Why**\nI searched for Bramble and got nothing. Email me: [email removed]");
        expect(cmd).toContain("**Source**\nAdmin › Mailbox, @Pat, 2026-10-15");
        expect(cmd).toContain("--ac '(write what will be true when it'\"'\"'s done)'");
        expect(cmd).not.toContain("pat@example.com");
    });

    it("keeps given acceptance criteria and notes", () => {
        const cmd = ticketCommand({
            title: "T",
            type: "feature",
            labels: ["shows"],
            why: "W",
            source: "S",
            notes: "/catalog/abc",
            acceptance: ["One", "Two"],
        });
        expect(cmd).toContain("**Notes**\n/catalog/abc");
        expect(cmd).toContain("--ac 'One' --ac 'Two'");
    });
});

describe("labelForContactCategory", () => {
    it("maps contact categories onto board labels", () => {
        expect(labelForContactCategory("account")).toBe("accounts");
        expect(labelForContactCategory("report")).toBe("moderation");
        expect(labelForContactCategory("idea")).toBe("platform");
    });
});
