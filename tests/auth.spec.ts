import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

test.describe('Authentication and Session Persistence', () => {
  
  test('Admin login flow and persistence', async ({ page }) => {
    await page.goto(`${APP_URL}/admin-login`);
    
    // Login
    await page.fill('input[placeholder="Enter admin credentials..."]', 'admin');
    await page.fill('input[placeholder="••••••••"]', 'nexus123');
    await page.click('button:has-text("AUTHENTICATE SECURELY")');
    
    // Should redirect to /admin
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('h1')).toContainText('Admin Central');
    
    // Navigation persistence
    await page.click('text=Dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Refresh persistence
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('header')).toContainText('ADMIN');
  });

  test('Agent login flow and persistence', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    // Login
    await page.fill('input[placeholder="Enter Your Username"]', 'agent');
    await page.fill('input[placeholder="Enter Your Password"]', 'nexus123');
    
    // Math security answer (parsing from label)
    const securityText = await page.locator('div:has-text("What is")').innerText();
    const matches = securityText.match(/What is (\d+) \+ (\d+) = \? :/);
    if (matches) {
      const sum = parseInt(matches[1]) + parseInt(matches[2]);
      await page.fill('input[placeholder="Answer"]', sum.toString());
    }
    
    await page.click('button:has-text("Sign In")');
    
    // Should redirect to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('header')).toContainText('AGENT');
    
    // Route guard test: try to go to admin-only area
    await page.goto(`${APP_URL}/admin`);
    // Should bounce back (handled by component logic)
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Client login flow and persistence', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    await page.fill('input[placeholder="Enter Your Username"]', 'client');
    await page.fill('input[placeholder="Enter Your Password"]', 'nexus123');
    
    const securityText = await page.locator('div:has-text("What is")').innerText();
    const matches = securityText.match(/What is (\d+) \+ (\d+) = \? :/);
    if (matches) {
      const sum = parseInt(matches[1]) + parseInt(matches[2]);
      await page.fill('input[placeholder="Answer"]', sum.toString());
    }
    
    await page.click('button:has-text("Sign In")');
    
    // Should redirect to /client/dashboard
    await expect(page).toHaveURL(/\/client\/dashboard/);
    await expect(page.locator('header')).toContainText('CLIENT');
    
    // Route guard test: try to go to agent area
    await page.goto(`${APP_URL}/dashboard`);
    await expect(page).toHaveURL(/\/client\/dashboard/);
  });

  test('Unauthorized access redirect to login', async ({ page }) => {
    await page.goto(`${APP_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });
});
