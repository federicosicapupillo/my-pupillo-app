import asyncio
import os
from pathlib import Path
from typing import Iterable, Optional

from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError, async_playwright


BASE_URL = os.environ.get("AUDIT_BASE_URL", "http://localhost:8080").rstrip("/")
OUT_DIR = Path("public/audit-screenshots")
PRIVATE_PASSWORD = os.environ.get("AUDIT_PRIVATE_ACCESS_PASSWORD")
WORKER_EMAIL = os.environ.get("AUDIT_WORKER_EMAIL")
WORKER_PASSWORD = os.environ.get("AUDIT_WORKER_PASSWORD")
RESTAURANT_EMAIL = os.environ.get("AUDIT_RESTAURANT_EMAIL")
RESTAURANT_PASSWORD = os.environ.get("AUDIT_RESTAURANT_PASSWORD")

MOBILE = {"width": 412, "height": 900}
DESKTOP = {"width": 1280, "height": 1800}

PUBLIC_SHOTS = [
    ("01-home-desktop.png", "/", DESKTOP, None),
    ("02-home-mobile.png", "/", MOBILE, None),
    ("03-come-funziona-desktop.png", "/come-funziona", DESKTOP, None),
    ("04-come-funziona-mobile.png", "/come-funziona", MOBILE, None),
    ("05-login-desktop.png", "/auth", DESKTOP, None),
    ("06-login-mobile.png", "/auth", MOBILE, None),
    ("07-register-worker-mobile.png", "/auth?role=worker", MOBILE, "signup_tab"),
    ("08-register-restaurant-mobile.png", "/auth?role=restaurant", MOBILE, "signup_tab"),
    ("09-reset-password-mobile.png", "/reset-password", MOBILE, None),
    ("10-login-error-mobile.png", "/auth", MOBILE, "login_error"),
    ("11-register-error-mobile.png", "/auth?role=worker", MOBILE, "register_error"),
    ("68-error-state-mobile.png", "/account-error", MOBILE, None),
]

WORKER_SHOTS = [
    ("12-worker-dashboard-mobile.png", "/dashboard", MOBILE, None),
    ("13-worker-profile-mobile.png", "/profile", MOBILE, None),
    ("14-worker-profile-edit-desktop.png", "/profile", DESKTOP, None),
    ("15-worker-availability-mobile.png", "/availability", MOBILE, None),
    ("16-worker-jobs-mobile.png", "/jobs", MOBILE, None),
    ("19-worker-offers-received-mobile.png", "/jobs", MOBILE, None),
    ("20-worker-offers-accepted-mobile.png", "/jobs", MOBILE, "accepted_tab"),
    ("21-worker-offers-rejected-mobile.png", "/jobs", MOBILE, "rejected_tab"),
    ("22-worker-shifts-confirmed-mobile.png", "/shifts?tab=assigned", MOBILE, None),
    ("23-worker-shifts-completed-mobile.png", "/shifts?tab=completed", MOBILE, None),
    ("24-worker-shifts-cancelled-mobile.png", "/shifts?tab=past", MOBILE, None),
    ("25-worker-reviews-mobile.png", "/profile", MOBILE, None),
    ("27-worker-messages-mobile.png", "/messages", MOBILE, None),
    ("28-worker-notifications-mobile.png", "/notifications", MOBILE, None),
    ("29-worker-account-settings-mobile.png", "/profile", MOBILE, None),
    ("30-worker-change-password-mobile.png", "/profile", MOBILE, "scroll_password"),
    ("31-worker-onboarding-mobile.png", "/onboarding", MOBILE, None),
    ("32-worker-help-support-mobile.png", "/messages", MOBILE, None),
    ("65-empty-state-mobile.png", "/notifications", MOBILE, None),
    ("66-data-state-mobile.png", "/dashboard", MOBILE, None),
    ("70-no-shifts-mobile.png", "/shifts", MOBILE, None),
    ("71-no-notifications-mobile.png", "/notifications", MOBILE, None),
]

RESTAURANT_SHOTS = [
    ("33-restaurant-dashboard-desktop.png", "/dashboard", DESKTOP, None),
    ("34-restaurant-profile-mobile.png", "/profile", MOBILE, None),
    ("35-restaurant-profile-edit-desktop.png", "/profile", DESKTOP, None),
    ("36-restaurant-announcement-new-mobile.png", "/announcements/new", MOBILE, None),
    ("37-restaurant-announcements-mobile.png", "/announcements", MOBILE, None),
    ("41-restaurant-workers-mobile.png", "/workers", MOBILE, None),
    ("45-restaurant-shifts-confirmed-mobile.png", "/shifts?tab=assigned", MOBILE, None),
    ("46-restaurant-shifts-completed-mobile.png", "/shifts?tab=completed", MOBILE, None),
    ("47-restaurant-shifts-cancelled-mobile.png", "/shifts?tab=past", MOBILE, None),
    ("48-restaurant-billing-mobile.png", "/billing", MOBILE, None),
    ("49-restaurant-reviews-mobile.png", "/ristoratore/recensioni", MOBILE, None),
    ("50-restaurant-messages-mobile.png", "/messages", MOBILE, None),
    ("51-restaurant-notifications-mobile.png", "/notifications", MOBILE, None),
    ("52-restaurant-account-settings-mobile.png", "/profile", MOBILE, None),
    ("53-restaurant-onboarding-mobile.png", "/onboarding", MOBILE, None),
    ("54-restaurant-help-support-mobile.png", "/messages", MOBILE, None),
    ("63-privacy-locked-mobile.png", "/workers", MOBILE, None),
]


async def grant_private_access(page: Page) -> None:
    await page.goto(BASE_URL + "/", wait_until="domcontentloaded")
    if PRIVATE_PASSWORD:
        try:
            if await page.get_by_text("Accesso riservato").count():
                await page.get_by_label("Password").fill(PRIVATE_PASSWORD)
                await page.get_by_role("button", name="Accedi").click()
                await page.wait_for_timeout(900)
        except PlaywrightTimeoutError:
            pass
    await page.evaluate(
        """
        () => {
          localStorage.setItem('pupillo-site-access', JSON.stringify({ granted: true, expiresAt: Date.now() + 86400000 }));
          localStorage.setItem('pupillo-theme', 'light');
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
        """
    )


async def stabilize(page: Page) -> None:
    try:
        await page.wait_for_load_state("networkidle", timeout=5000)
    except PlaywrightTimeoutError:
        pass
    await page.wait_for_timeout(900)


async def apply_state(page: Page, state: Optional[str]) -> None:
    if state == "signup_tab":
        try:
            await page.get_by_text("Registrati").click(timeout=2000)
        except Exception:
            pass
    elif state == "login_error":
        await page.get_by_label("Email").fill("errore-audit@example.invalid")
        await page.get_by_label("Password").fill("password-sbagliata")
        await page.get_by_role("button", name="Accedi").last.click()
        await page.wait_for_timeout(1400)
    elif state == "register_error":
        try:
            await page.get_by_text("Registrati").click(timeout=2000)
        except Exception:
            pass
        try:
            await page.get_by_role("button", name="Crea profilo").click(force=True, timeout=2000)
        except Exception:
            pass
        await page.wait_for_timeout(700)
    elif state == "scroll_password":
        try:
            await page.locator("text=Cambia password").scroll_into_view_if_needed(timeout=3000)
            await page.wait_for_timeout(300)
        except Exception:
            pass
    elif state in {"accepted_tab", "rejected_tab"}:
        label = "Accettate" if state == "accepted_tab" else "Rifiutate"
        try:
            await page.get_by_role("button", name=label).click(timeout=2000)
            await page.wait_for_timeout(500)
        except Exception:
            pass


async def invalid_page(page: Page, authenticated_expected: bool) -> Optional[str]:
    text = (await page.locator("body").inner_text(timeout=3000)).lower()
    if "accesso riservato" in text or "fase di test privato" in text:
        return "private gate"
    if authenticated_expected and ("benvenuto in pupillo" in text or "accedi o crea" in text):
        return "login redirect"
    if authenticated_expected and text.strip() == "caricamento…":
        return "stuck loading"
    return None


async def capture(page: Page, filename: str, route: str, viewport: dict, state: Optional[str], authenticated_expected: bool) -> tuple[bool, str]:
    await page.set_viewport_size(viewport)
    await page.goto(BASE_URL + route, wait_until="domcontentloaded")
    await stabilize(page)
    await apply_state(page, state)
    reason = await invalid_page(page, authenticated_expected)
    if reason:
        return False, reason
    await page.screenshot(path=str(OUT_DIR / filename), full_page=False)
    return True, "ok"


async def login(page: Page, email: str, password: str) -> bool:
    await page.goto(BASE_URL + "/auth", wait_until="domcontentloaded")
    await stabilize(page)
    await page.get_by_label("Email").fill(email)
    await page.get_by_label("Password").fill(password)
    await page.get_by_role("button", name="Accedi").last.click()
    await page.wait_for_timeout(3500)
    text = (await page.locator("body").inner_text(timeout=3000)).lower()
    return "benvenuto in pupillo" not in text and "email o password" not in text and "accesso riservato" not in text


async def run_set(browser, shots: Iterable[tuple], email: Optional[str] = None, password: Optional[str] = None) -> list[tuple[str, bool, str]]:
    context = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await context.new_page()
    await grant_private_access(page)
    results = []
    authed = email is not None and password is not None
    if authed:
        ok = await login(page, email or "", password or "")
        if not ok:
            await context.close()
            return [(name, False, "login failed") for name, *_ in shots]
    for name, route, viewport, state in shots:
        ok, reason = await capture(page, name, route, viewport, state, authenticated_expected=authed)
        results.append((name, ok, reason))
        print(("OK" if ok else "SKIP"), name, reason)
    await context.close()
    return results


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for png in OUT_DIR.glob("*.png"):
        png.unlink()

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        all_results = []
        all_results += await run_set(browser, PUBLIC_SHOTS)
        if WORKER_EMAIL and WORKER_PASSWORD:
            all_results += await run_set(browser, WORKER_SHOTS, WORKER_EMAIL, WORKER_PASSWORD)
        else:
            print("SKIP worker authenticated screenshots: set AUDIT_WORKER_EMAIL and AUDIT_WORKER_PASSWORD")
        if RESTAURANT_EMAIL and RESTAURANT_PASSWORD:
            all_results += await run_set(browser, RESTAURANT_SHOTS, RESTAURANT_EMAIL, RESTAURANT_PASSWORD)
        else:
            print("SKIP restaurant authenticated screenshots: set AUDIT_RESTAURANT_EMAIL and AUDIT_RESTAURANT_PASSWORD")
        await browser.close()

    valid = [name for name, ok, _ in all_results if ok]
    invalid = [(name, reason) for name, ok, reason in all_results if not ok]
    print("\nSUMMARY")
    print("valid:", len(valid))
    for name in valid:
        print("  +", name)
    print("invalid/skipped:", len(invalid))
    for name, reason in invalid:
        print("  -", name, reason)


if __name__ == "__main__":
    asyncio.run(main())