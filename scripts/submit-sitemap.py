"""Verify the deployed sitemap before submitting it to Google Search Console."""

import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


def submit(site_url, property_url, token, expected, *, open_url=urlopen, sleep=time.sleep):
    parsed = urlsplit(site_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("SITE_URL must be a published HTTPS URL without query or fragment")
    if not property_url or not token:
        raise ValueError("Search Console property and access token are required")

    # Preserve a GitHub Pages project site's path prefix.
    sitemap_url = site_url.rstrip("/") + "/sitemap.xml"
    root = ET.fromstring(expected)
    if root.tag != "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset":
        raise ValueError("Built sitemap is not a sitemap urlset")
    if not root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
        raise ValueError("Built sitemap has no URLs")

    # Pages publication and CDN propagation can lag behind the deploy action.
    for attempt in range(5):
        try:
            request = Request(sitemap_url, headers={"Cache-Control": "no-cache"})
            with open_url(request, timeout=20) as response:
                if response.status != 200:
                    raise ValueError("Live sitemap did not return HTTP 200")
                live = response.read(len(expected) + 1)
            if live != expected:
                raise ValueError("Live sitemap does not match this deployment")
            break
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            if isinstance(error, HTTPError):
                error.close()
            if attempt == 4:
                raise
            sleep(10)

    endpoint = (
        "https://www.googleapis.com/webmasters/v3/sites/"
        + quote(property_url, safe="")
        + "/sitemaps/"
        + quote(sitemap_url, safe="")
    )
    request = Request(endpoint, data=b"", method="PUT", headers={
        "Authorization": "Bearer " + token,
    })
    with open_url(request, timeout=30) as response:
        if not 200 <= response.status < 300:
            raise ValueError("Search Console rejected sitemap submission")
    print("Verified deployed sitemap and submitted it to Search Console.")


if __name__ == "__main__":
    try:
        submit(
            os.environ["SITE_URL"],
            os.environ["GSC_SITE_URL"],
            os.environ["GOOGLE_ACCESS_TOKEN"],
            Path("sveltekit/build/sitemap.xml").read_bytes(),
        )
    except Exception as error:
        # Do not print credentials or arbitrary HTTP response bodies in CI logs.
        detail = f"HTTP {error.code}" if isinstance(error, HTTPError) else type(error).__name__
        if isinstance(error, HTTPError):
            error.close()
        print(f"Sitemap verification/submission failed ({detail}).", file=sys.stderr)
        sys.exit(1)
