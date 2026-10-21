import unittest
import sys
from unittest.mock import Mock
from pathlib import Path

import matplotlib.pyplot as plt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.figure_export import save_for_journal, save_publication_figure


class FigureExportTests(unittest.TestCase):
    def tearDown(self):
        plt.close("all")

    def test_publication_export_defaults_to_transparent_tight_high_dpi(self):
        fig, _ = plt.subplots()
        fig.savefig = Mock()

        save_publication_figure(fig, "figure", formats=["png", "pdf"])

        png_kwargs = fig.savefig.call_args_list[0].kwargs
        pdf_kwargs = fig.savefig.call_args_list[1].kwargs
        self.assertEqual(png_kwargs["bbox_inches"], "tight")
        self.assertTrue(png_kwargs["transparent"])
        self.assertEqual(png_kwargs["facecolor"], "none")
        self.assertGreaterEqual(png_kwargs["dpi"], 600)
        self.assertGreaterEqual(pdf_kwargs["dpi"], 600)

    def test_journal_export_forces_nontransparent_background(self):
        fig, _ = plt.subplots()
        fig.savefig = Mock()

        save_for_journal(fig, "figure", journal="nature", figure_type="combination")

        kwargs = fig.savefig.call_args.kwargs
        self.assertFalse(kwargs["transparent"])
        self.assertEqual(kwargs["facecolor"], "white")
        self.assertEqual(kwargs["bbox_inches"], "tight")

    def test_publication_export_rejects_missing_output_parent(self):
        fig, _ = plt.subplots()
        missing_parent = Path("definitely_missing_parent") / "subdir" / "figure"

        with self.assertRaises(FileNotFoundError):
            save_publication_figure(fig, missing_parent, formats=["png"])


if __name__ == "__main__":
    unittest.main()
