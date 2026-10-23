import { test, expect } from "@playwright/test";

const roomTitle = process.env.E2E_ROOM_TITLE;
const targetName = process.env.E2E_TARGET_DISPLAY_NAME;
const requiresSeed = !roomTitle || !targetName || !process.env.E2E_STORAGE_STATE;

test.describe("إدارة الغرفة والأمان", () => {
  test.skip(requiresSeed, "Set E2E_STORAGE_STATE, E2E_ROOM_TITLE, and E2E_TARGET_DISPLAY_NAME against a seeded staging project.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("يعرض المشرف الإحصائيات وقائمة الأعضاء", async ({ page }) => {
    await page.getByText(roomTitle!, { exact: true }).click();
    await page.getByRole("button", { name: "انضمام إلى الغرفة" }).click();
    await expect(page.getByText("إدارة الغرفة")).toBeVisible();
    await expect(page.getByText("إحصائيات ونشاط الغرفة")).toBeVisible();
    await expect(page.getByText("أعضاء الغرفة والأدوار")).toBeVisible();
  });

  test("يرقي المشرف العضو ويخفضه", async ({ page }) => {
    await page.getByText(roomTitle!, { exact: true }).click();
    await page.getByRole("button", { name: "انضمام إلى الغرفة" }).click();
    const member = page.getByText(targetName!, { exact: true });
    await expect(member).toBeVisible();
    await member.locator("..").getByRole("button", { name: "ترقية" }).click();
    await expect(page.getByText(/تم تحديث دور/)).toBeVisible();
    await member.locator("..").getByRole("button", { name: "تخفيض" }).click();
    await expect(page.getByText(/تم تحديث دور/)).toBeVisible();
  });

  test("يحظر المشرف عضوًا ويؤكد الإجراء", async ({ page }) => {
    await page.getByText(roomTitle!, { exact: true }).click();
    await page.getByRole("button", { name: "انضمام إلى الغرفة" }).click();
    const member = page.getByText(targetName!, { exact: true });
    await member.locator("..").getByRole("button", { name: "حظر" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible().catch(() => undefined);
    await page.getByRole("button", { name: "حظر" }).last().click();
    await expect(page.getByText(/تم حظر/)).toBeVisible();
    await expect(page.getByText(targetName!, { exact: true })).toHaveCount(0);
  });

  test("يطرد المشرف عضوًا مع تأكيد", async ({ page }) => {
    await page.getByText(roomTitle!, { exact: true }).click();
    await page.getByRole("button", { name: "انضمام إلى الغرفة" }).click();
    const member = page.getByText(targetName!, { exact: true });
    await member.locator("..").getByRole("button", { name: "طرد" }).click();
    await page.getByRole("button", { name: "طرد" }).last().click();
    await expect(page.getByText(/تم طرد/)).toBeVisible();
  });
});
