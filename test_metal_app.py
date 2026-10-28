import unittest
from pathlib import Path
from metal_app import parse_pdf, make_payload

class ExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pdf = Path('C:/Users/hanyoung/OneDrive/Desktop/환경프로젝트/중금속데이터.pdf')
        cls.records = parse_pdf(cls.pdf)

    def test_page_breaks_and_values(self):
        self.assertEqual(len(self.records), 18)
        self.assertEqual(self.records[-1]['sample'], 'NDG W-10')
        self.assertEqual(self.records[12]['metals']['Cd']['conc'], .00343)
        self.assertEqual(self.records[9]['metals']['Pb']['conc'], -.00005)
        self.assertEqual(self.records[11]['metals']['As']['rsd_conc'], '>999.9%')

    def test_template_mapping(self):
        p = make_payload(self.records, 'first.xlsx', 'second.xls', Path('output'))
        self.assertEqual(len(p['standards']), 6)
        self.assertEqual(p['blank']['metals']['As']['conc'], .00939)
        self.assertEqual(p['normalized'], [f'W-{i}' for i in range(1, 11)])

    def test_missing_blank_rejected(self):
        with self.assertRaises(ValueError):
            make_payload([r for r in self.records if r['sample'] != 'W-BK'], 'a', 'b', Path('output'))

if __name__ == '__main__':
    unittest.main()
