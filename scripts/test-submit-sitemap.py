import importlib.util
from io import BytesIO
from pathlib import Path
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location("submit_sitemap", Path(__file__).with_name("submit-sitemap.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

XML = b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/blog/</loc></url></urlset>'


def response(body=b"", status=200):
    result = Mock(status=status)
    result.read.return_value = body
    result.__enter__ = Mock(return_value=result)
    result.__exit__ = Mock(return_value=False)
    return result


class SubmitTests(unittest.TestCase):
    def run_submit(self, opener, **kwargs):
        module.submit("https://example.com/blog/", "sc-domain:example.com", "token", XML,
                      open_url=opener, sleep=lambda _: None, **kwargs)

    def test_verifies_live_sitemap_before_encoded_put(self):
        opener = Mock(side_effect=[response(XML), response(status=204)])
        self.run_submit(opener)
        live, api = [call.args[0] for call in opener.call_args_list]
        self.assertEqual(live.full_url, "https://example.com/blog/sitemap.xml")
        self.assertFalse(live.has_header("Authorization"))
        self.assertEqual(api.method, "PUT")
        self.assertEqual(api.full_url, "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/sitemaps/https%3A%2F%2Fexample.com%2Fblog%2Fsitemap.xml")
        self.assertEqual(api.get_header("Authorization"), "Bearer token")

    def test_retries_stale_or_unavailable_sitemap(self):
        opener = Mock(side_effect=[URLError("offline"), response(b"stale"), response(XML), response()])
        self.run_submit(opener)
        self.assertEqual(opener.call_count, 4)

    def test_never_submits_stale_html_or_invalid_xml(self):
        for body in (b"stale sitemap", b"<html>Not found</html>"):
            opener = Mock(side_effect=lambda *args, **kwargs: response(body))
            with self.assertRaises(ValueError):
                self.run_submit(opener)
            self.assertEqual(opener.call_count, 5)
            self.assertTrue(all(call.args[0].get_method() == "GET" for call in opener.call_args_list))

    def test_rejects_invalid_built_sitemap_without_network(self):
        opener = Mock()
        with self.assertRaises(ValueError):
            module.submit("https://example.com", "https://example.com/", "token", b"<html/>", open_url=opener)
        opener.assert_not_called()

    def test_url_prefix_property_is_encoded(self):
        opener = Mock(side_effect=[response(XML), response()])
        module.submit("https://example.com/blog", "https://example.com/blog/", "token", XML,
                      open_url=opener)
        self.assertIn("/sites/https%3A%2F%2Fexample.com%2Fblog%2F/sitemaps/",
                      opener.call_args.args[0].full_url)

    def test_rejects_missing_configuration_without_network(self):
        for site, prop, token in (("http://example.com", "property", "token"),
                                  ("https://example.com", "", "token"),
                                  ("https://example.com", "property", "")):
            opener = Mock()
            with self.assertRaises(ValueError):
                module.submit(site, prop, token, XML, open_url=opener)
            opener.assert_not_called()

    def test_api_failure_is_reported_to_workflow(self):
        opener = Mock(side_effect=[response(XML), HTTPError("api", 403, "Forbidden", {}, BytesIO())])
        with self.assertRaises(HTTPError) as caught:
            self.run_submit(opener)
        caught.exception.close()


if __name__ == "__main__":
    unittest.main()
