/**
 * Attempts to dismiss common overlay dialogs such as cookie consent banners
 * or "OK" popups by searching for typical buttons and clicking them.
 */
export async function DismissOverlays(page) {
  const candidates = [
    page.getByRole("button", { name: /accept all|accept|agree|allow/i }),
    page.getByRole("dialog").getByRole("button", { name: /ok|close|got it/i }),
    page.locator('[aria-label*="accept cookies" i], [id*="accept"]'),
    page.locator('button:has-text("OK")'),
    // Some sites use iframes for consent:
    page
      .frameLocator('iframe[title*="consent" i], iframe[id*="sp_message_iframe" i]')
      .locator('button, [role="button"]')
      .filter({ hasText: /accept|agree|ok/i })
      .first(),
  ];
  for (const loc of candidates) {
    try {
      if (await loc.isVisible({ timeout: 1500 })) {
        await loc.click({ timeout: 3000 });
        // tiny pause to let layout settle
        await page.waitForTimeout(250);
      }
    } catch {
      /* ignore if not there */
    }
  }
}

/**
 * Clicks the "View all … restaurants" button (if present), then scrolls the page
 * to load all results, and finally returns an array of restaurant names.
 *
 * Strategy for the button:
 *  - Try multiple locators (role-based, :has-text, and a generic text regex).
 *  - Scroll into view, validate with a trial click, then click.
 *  - If not visible, scroll to bottom a few times to reveal it, then retry.
 *
 * Strategy for loading all names:
 *  - Repeatedly scroll near the bottom until the number of name nodes stops growing.
 */
export async function GetRestaurantNames(page) {
  // --- 1) Try to click the "View all … restaurants" button if it exists ---
  async function TryClickViewAll() {
    const candidates = [
      // role-based with accessible name
      page.getByRole("button", { name: /view all\s+\d+\s+available restaurants/i }),
      page.getByRole("button", { name: /view all.*restaurants/i }),
      // sometimes it could be a link styled as a button
      page.getByRole("link", { name: /view all.*restaurants/i }),
      // text-based fallbacks
      page.locator("button:has-text(/view all.*restaurants/i)"),
      page.locator("text=/^\\s*view all\\b.*restaurants\\s*$/i"),
      // generic button at bottom as last resort (will verify text before click)
      page.locator("button").last(),
    ];

    // reveal bottom area first (some pages only render the button near bottom)
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight * 0.95)));
      await page.waitForTimeout(200);
    }

    const before_count = await page
      .locator(".css-11vv3pc")
      .count()
      .catch(() => 0);

    for (const loc of candidates) {
      try {
        const handle = loc.first();
        // ensure it's attached; skip quickly if not found
        const is_attached = await handle.isVisible({ timeout: 1200 }).catch(() => false);
        if (!is_attached) continue;

        // verify it actually contains "view all" + "restaurants" to avoid wrong clicks
        const txt = (await handle.innerText().catch(() => "")).toLowerCase();
        if (!/view all/.test(txt) || !/restaurant/.test(txt)) {
          // it might be the generic last() candidate; skip if text doesn't match
          if (loc !== candidates[candidates.length - 1]) continue;
        }

        await handle.scrollIntoViewIfNeeded().catch(() => {});
        // trial click ensures it's hittable (won't commit)
        await handle.click({ trial: true, timeout: 2000 }).catch(() => {});
        await handle.click({ timeout: 4000 });

        // wait for the listing to expand or network to go idle
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(800);

        // check if we now have (or can get) more cards visible
        // do a couple of scrolls to trigger rendering after click
        for (let i = 0; i < 6; i++) {
          await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight * 0.95)));
          await page.waitForTimeout(200);
        }

        const after_count = await page
          .locator(".css-11vv3pc")
          .count()
          .catch(() => 0);
        if (after_count > before_count) {
          // success: clearly expanded the list
          return true;
        }
        // even if count not increased yet, we still tried; continue to next candidate
      } catch {
        // try next candidate
      }
    }
    return false;
  }

  await TryClickViewAll().catch(() => {});

  // --- 2) Scroll until the number of name nodes stabilizes ---
  let last_count = -1;
  let stable_cycles = 0;
  for (let i = 0; i < 120; i++) {
    await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight * 0.95)));
    await page.waitForTimeout(350);

    const count = await page
      .locator(".css-11vv3pc")
      .count()
      .catch(() => last_count);
    if (count === last_count) {
      stable_cycles += 1;
      if (stable_cycles >= 3) break; // no more growth after 3 checks
    } else {
      stable_cycles = 0;
      last_count = count;
    }
  }

  // --- 3) Collect all names safely ---
  const name_locs = page.locator(".css-11vv3pc");
  const total = await name_locs.count();
  const names = [];

  for (let i = 0; i < total; i++) {
    try {
      const node = name_locs.nth(i);
      await node.scrollIntoViewIfNeeded().catch(() => {});
      const text = await node.textContent({ timeout: 1500 }).catch(() => null);
      const name = text?.trim();
      if (name) names.push(name);
    } catch {
      // skip this one
    }
  }

  return names;
}
