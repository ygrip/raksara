import importlib.util
from io import BytesIO
from pathlib import Path
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location("submit_sitemap", Path(__file__).with_name("submit-sitemap.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def response(status=200):
    result = Mock(status=status)
    result.__enter__ = Mock(return_value=result)
    result.__exit__ = Mock(return_value=False)
    return result


class SubmitTests(unittest.TestCase):
    def run_submit(self, opener):
        module.submit("https://example.com/blog/", "sc-domain:example.com", "token",
                      open_url=opener)

    def test_submits_encoded_put_directly_without_fetching_site(self):
        opener = Mock(return_value=response(status=204))
        self.run_submit(opener)
        opener.assert_called_once()
        api = opener.call_args.args[0]
        self.assertEqual(api.method, "PUT")
        self.assertEqual(api.full_url, "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/sitemaps/https%3A%2F%2Fexample.com%2Fblog%2Fsitemap.xml")
        self.assertEqual(api.get_header("Authorization"), "Bearer token")
        self.assertEqual(api.data, b"")
        self.assertEqual(opener.call_args.kwargs, {"timeout": 30})

    def test_url_prefix_property_is_encoded(self):
        opener = Mock(return_value=response())
        module.submit("https://example.com/blog", "https://example.com/blog/", "token",
                      open_url=opener)
        opener.assert_called_once()
        self.assertIn("/sites/https%3A%2F%2Fexample.com%2Fblog%2F/sitemaps/",
                      opener.call_args.args[0].full_url)

    def test_rejects_invalid_configuration_without_network(self):
        for site, prop, token in (("http://example.com", "property", "token"),
                                  ("https://example.com?query=1", "property", "token"),
                                  ("https://example.com#fragment", "property", "token"),
                                  ("https://", "property", "token"),
                                  ("https://example.com", "", "token"),
                                  ("https://example.com", "property", "")):
            with self.subTest(site=site, prop=prop, token=token):
                opener = Mock()
                with self.assertRaises(ValueError):
                    module.submit(site, prop, token, open_url=opener)
                opener.assert_not_called()

    def test_api_failure_is_reported_to_workflow(self):
        opener = Mock(side_effect=HTTPError("api", 403, "Forbidden", {}, BytesIO()))
        with self.assertRaises(HTTPError) as caught:
            self.run_submit(opener)
        caught.exception.close()
        opener.assert_called_once()

    def test_network_failure_is_reported_without_retry(self):
        opener = Mock(side_effect=URLError("offline"))
        with self.assertRaises(URLError):
            self.run_submit(opener)
        opener.assert_called_once()

    def test_non_success_response_is_rejected(self):
        opener = Mock(return_value=response(status=403))
        with self.assertRaises(ValueError):
            self.run_submit(opener)
        opener.assert_called_once()


if __name__ == "__main__":
    unittest.main()
