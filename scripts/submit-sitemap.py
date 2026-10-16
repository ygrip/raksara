"""Submit the deployed sitemap URL directly to Google Search Console."""

import os
import sys
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


def submit(site_url, property_url, token, *, open_url=urlopen):
    parsed = urlsplit(site_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("SITE_URL must be a published HTTPS URL without query or fragment")
    if not property_url or not token:
        raise ValueError("Search Console property and access token are required")

    # Preserve a GitHub Pages project site's path prefix.
    sitemap_url = site_url.rstrip("/") + "/sitemap.xml"
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
    print("Submitted sitemap URL to Search Console.")


if __name__ == "__main__":
    try:
        submit(
            os.environ["SITE_URL"],
            os.environ["GSC_SITE_URL"],
            os.environ["GOOGLE_ACCESS_TOKEN"],
        )
    except Exception as error:
        # Do not print credentials or arbitrary HTTP response bodies in CI logs.
        detail = f"HTTP {error.code}" if isinstance(error, HTTPError) else type(error).__name__
        if isinstance(error, HTTPError):
            error.close()
        print(f"Sitemap submission failed ({detail}).", file=sys.stderr)
        sys.exit(1)
