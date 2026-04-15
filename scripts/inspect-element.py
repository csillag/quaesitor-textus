#!/usr/bin/env python3
"""Quick DOM/CSS inspector using Playwright headless browser.

Usage:
    python scripts/inspect-element.py <url> <css_selector> [--screenshot path.png] [--styles prop1,prop2,...]

Examples:
    python scripts/inspect-element.py http://localhost:5173/processes "div:has(> span)" --screenshot /tmp/debug.png
    python scripts/inspect-element.py http://localhost:5173/processes ".ant-layout-content > div > div:first-child" --styles display,justifyContent,width
"""

import argparse
import asyncio
import json
import sys


async def main():
    parser = argparse.ArgumentParser(description="Inspect DOM elements via headless browser")
    parser.add_argument("url", help="Page URL to load")
    parser.add_argument("selector", help="CSS selector to inspect")
    parser.add_argument("--screenshot", help="Save screenshot of element to this path")
    parser.add_argument("--styles", help="Comma-separated CSS properties to dump (default: common layout props)")
    parser.add_argument("--full-screenshot", help="Save full page screenshot to this path")
    parser.add_argument("--wait", type=float, default=2.0, help="Seconds to wait for page load (default: 2)")
    parser.add_argument("--children", action="store_true", help="Also inspect direct children")
    args = parser.parse_args()

    from playwright.async_api import async_playwright

    default_styles = "display,flexDirection,justifyContent,alignItems,width,height,margin,padding,flex,overflow,position"
    style_props = (args.styles or default_styles).split(",")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto(args.url, wait_until="domcontentloaded")
        await asyncio.sleep(args.wait)

        if args.full_screenshot:
            await page.screenshot(path=args.full_screenshot, full_page=True)
            print(f"Full page screenshot: {args.full_screenshot}")

        elements = await page.query_selector_all(args.selector)
        if not elements:
            print(f"No elements found for selector: {args.selector}")
            await browser.close()
            sys.exit(1)

        for i, el in enumerate(elements):
            tag = await el.evaluate("e => e.tagName.toLowerCase()")
            classes = await el.evaluate("e => e.className")
            text = await el.evaluate("e => e.textContent?.slice(0, 80)")
            bbox = await el.bounding_box()

            print(f"\n--- Element {i}: <{tag}> class=\"{classes}\" ---")
            print(f"  Text: {text!r}")
            print(f"  BBox: {bbox}")

            computed = await el.evaluate("""(e, props) => {
                const s = window.getComputedStyle(e);
                const result = {};
                for (const p of props) {
                    result[p] = s.getPropertyValue(p) || s[p] || '';
                }
                result['_offsetWidth'] = e.offsetWidth;
                result['_offsetHeight'] = e.offsetHeight;
                result['_clientWidth'] = e.clientWidth;
                return result;
            }""", style_props)
            print(f"  Computed styles:")
            for k, v in computed.items():
                print(f"    {k}: {v}")

            if args.screenshot and i == 0:
                await el.screenshot(path=args.screenshot)
                print(f"  Screenshot: {args.screenshot}")

            if args.children:
                children = await el.query_selector_all(":scope > *")
                for j, child in enumerate(children):
                    ctag = await child.evaluate("e => e.tagName.toLowerCase()")
                    cclasses = await child.evaluate("e => e.className")
                    ctext = await child.evaluate("e => e.textContent?.slice(0, 60)")
                    cbbox = await child.bounding_box()
                    ccomputed = await child.evaluate("""(e, props) => {
                        const s = window.getComputedStyle(e);
                        const result = {};
                        for (const p of props) {
                            result[p] = s.getPropertyValue(p) || s[p] || '';
                        }
                        result['_offsetWidth'] = e.offsetWidth;
                        return result;
                    }""", style_props)
                    print(f"  Child {j}: <{ctag}> class=\"{cclasses}\"")
                    print(f"    Text: {ctext!r}")
                    print(f"    BBox: {cbbox}")
                    for k, v in ccomputed.items():
                        print(f"      {k}: {v}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
