import unittest
import check

BASE = 'http://127.0.0.1:18615'


def page(rss=True, sitemap=True):
    head, footer = '', ''
    for on, route, rel, mime, marker in [(rss, '/rss.xml', 'alternate', 'application/rss+xml', 'data-theme-rss'), (sitemap, '/sitemap.xml', 'sitemap', 'application/xml', 'data-theme-sitemap')]:
        if on:
            head += f'<link rel="{rel}" type="{mime}" href="{route}" {marker}>'
            footer += f'<a href="{route}" {marker}>Subscription</a>'
    return f'<head>{head}<link rel="canonical" href="{BASE}/post"></head><body>{footer}</body>'


class FeedSitemapGuardTest(unittest.TestCase):
    def test_head_footer_and_canonical(self):
        for rss, sitemap in [(True, True), (True, False), (False, True), (False, False)]:
            check.check_page(page(rss, sitemap), BASE, rss, sitemap, BASE + '/post')

    def test_duplicate_injected_rss_is_rejected(self):
        duplicate = '<link rel="alternate" type="application/rss+xml" href="/rss.xml">'
        with self.assertRaisesRegex(AssertionError, 'duplicate discovery'):
            check.check_page(page().replace('</head>', duplicate + '</head>'), BASE, True, True)

    def test_stopped_plugin_stale_head_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'discovery'):
            check.check_page(page(), BASE, False, True)

    def test_wrong_canonical_and_external_destination_are_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'Canonical'):
            check.check_page(page(), BASE, True, True, BASE + '/other')
        with self.assertRaisesRegex(AssertionError, 'destination'):
            check.check_page(page().replace('href="/rss.xml"', 'href="https://other.test/rss.xml"'), BASE, True, True)

    def test_rss_and_sitemap_parse_values(self):
        rss = '<rss version="2.0"><channel><item><title>A &amp; B</title><link>https://site/post</link><description><![CDATA[<p>body</p>]]></description></item></channel></rss>'
        self.assertEqual(check.rss_items(rss)['https://site/post'], {'title': 'A & B', 'description': '<p>body</p>'})
        sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://site/post?a=1&amp;b=2</loc><lastmod>2026-10-15</lastmod></url></urlset>'
        self.assertEqual(check.sitemap_items(sitemap), {'https://site/post?a=1&b=2': '2026-10-15'})

    def test_duplicates_and_non_xml_routes_are_rejected(self):
        for parse, body in [(check.rss_items, '<html/>'), (check.sitemap_items, '<html/>'), (check.rss_items, '<rss version="2.0"><channel><item><link>x</link></item><item><link>x</link></item></channel></rss>'), (check.sitemap_items, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>x</loc></url><url><loc>x</loc></url></urlset>')]:
            with self.assertRaises(AssertionError):
                parse(body)

    def test_private_draft_leak_and_public_missing_are_rejected(self):
        check.check_members({'public': {}}, ['public'], ['private', 'draft'])
        with self.assertRaisesRegex(AssertionError, 'leaked'):
            check.check_members({'public': {}, 'private': {}}, ['public'], ['private', 'draft'])
        with self.assertRaisesRegex(AssertionError, 'missing'):
            check.check_members({}, ['public'], ['private', 'draft'])


if __name__ == '__main__':
    unittest.main()
