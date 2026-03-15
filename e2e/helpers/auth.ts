import { Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
}

export const USER_A = {
    email: process.env.TEST_USER_A_EMAIL || "testbot@example.com",
    password: process.env.TEST_USER_A_PASSWORD || "testpassword123",
};

export const USER_B = {
    email: process.env.TEST_USER_B_EMAIL || "testbot2@example.com",
    password: process.env.TEST_USER_B_PASSWORD || "testpassword123",
};
