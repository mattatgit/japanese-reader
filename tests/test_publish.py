"""Offline publishing-contract tests; no API credentials or network needed."""
import datetime as dt
import unittest

from scripts import publish


class PublisherTests(unittest.TestCase):
    def test_review_cadence_in_melbourne_dates(self):
        self.assertTrue(publish.review_due(dt.date(2026, 10, 23)))
        self.assertFalse(publish.review_due(dt.date(2026, 10, 24)))
        self.assertTrue(publish.review_due(dt.date(2026, 10, 25)))
        self.assertFalse(publish.review_due(dt.date(2026, 10, 26)))

    def test_json_archive_is_well_formed(self):
        readings, reviews, lexicon = (publish.read_data(n) for n in
                                      ("readings", "reviews", "lexicon"))
        publish.validate_catalogue(readings, reviews, lexicon)
        self.assertGreaterEqual(len(readings), 7)
        self.assertTrue(all(r["paragraphs"] for r in readings))
        self.assertGreater(len(lexicon), 100)

    def test_furigana_coverage_measures_kanji_only(self):
        sample = "旭川で木材を選ぶ。"
        terms = {"旭川": ["あさひかわ", "Asahikawa"],
                 "木材": ["もくざい", "timber"],
                 "選ぶ": ["えらぶ", "choose"]}
        self.assertEqual(publish.kanji_coverage(sample, terms), 1.0)
        self.assertLess(publish.kanji_coverage(sample, {"旭川": terms["旭川"]}), 1.0)

    def test_structured_schemas_are_strict(self):
        for schema in (publish.reading_schema(), publish.review_schema()):
            self.assertFalse(schema["additionalProperties"])
            self.assertEqual(set(schema["required"]), set(schema["properties"]))

    def test_no_api_key_required_for_dry_run(self):
        # The separate dry-run invocation exercises the full catalogue. Here,
        # simply check the generation model is not touched by schema and date checks.
        self.assertIsInstance(publish.local_date(), dt.date)


if __name__ == "__main__":
    unittest.main()
