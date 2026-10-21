import unittest
import sys
from pathlib import Path
from unittest.mock import patch

import matplotlib as mpl
import matplotlib.pyplot as plt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import style_presets


class DummyFont:
    def __init__(self, name):
        self.name = name


class StylePresetTests(unittest.TestCase):
    def tearDown(self):
        mpl.rcdefaults()

    def test_rcparams_uses_safe_font_stack_when_pretendard_and_arial_missing(self):
        fonts = [DummyFont("DejaVu Sans"), DummyFont("AppleGothic")]

        with patch.object(style_presets.font_manager.fontManager, "ttflist", fonts):
            style_presets.rcparams()

        self.assertEqual(mpl.rcParams["font.family"], ["sans-serif"])
        self.assertEqual(mpl.rcParams["font.sans-serif"][:2], ["DejaVu Sans", "AppleGothic"])
        self.assertEqual(mpl.rcParams["pdf.fonttype"], 42)
        self.assertEqual(mpl.rcParams["ps.fonttype"], 42)
        self.assertEqual(mpl.rcParams["svg.fonttype"], "none")

    def test_rcparams_prioritizes_pretendard_then_arial_when_available(self):
        fonts = [DummyFont("Arial"), DummyFont("Helvetica"), DummyFont("Pretendard"), DummyFont("DejaVu Sans")]

        with patch.object(style_presets.font_manager.fontManager, "ttflist", fonts):
            style_presets.rcparams()

        self.assertEqual(mpl.rcParams["font.sans-serif"][:2], ["Pretendard", "Arial"])

    def test_rcparams_forces_agent_safe_grid_and_transparent_export_defaults(self):
        mpl.rcParams["axes.grid"] = True
        mpl.rcParams["savefig.transparent"] = False

        style_presets.rcparams()

        self.assertFalse(mpl.rcParams["axes.grid"])
        self.assertEqual(mpl.rcParams["savefig.bbox"], "tight")
        self.assertTrue(mpl.rcParams["savefig.transparent"])

    def test_configure_for_journal_validates_widths_and_supports_one_half_column(self):
        style_presets.configure_for_journal("nature", "one_half")
        width, height = mpl.rcParams["figure.figsize"]

        self.assertAlmostEqual(width, 120 / 25.4, places=3)
        self.assertLessEqual(height, 170 / 25.4)

        with self.assertRaises(ValueError):
            style_presets.configure_for_journal("nature", "poster")

    def test_ensure_zero_origin_ticks_keeps_first_tick_at_zero(self):
        style_presets.rcparams()
        fig, ax = plt.subplots()
        ax.plot([0, 1, 2], [0, 50, 100])
        ax.set_ylim(0, 100)

        style_presets.ensure_zero_origin_ticks(ax, y=True, nbins=5)

        self.assertEqual(ax.get_ylim()[0], 0)
        self.assertAlmostEqual(ax.get_yticks()[0], 0)
        self.assertTrue(all(tick >= 0 for tick in ax.get_yticks()))
        plt.close(fig)

    def test_style_legend_keeps_black_text_for_nature_and_colored_text_when_requested(self):
        style_presets.rcparams()
        fig, ax = plt.subplots()
        line_a, = ax.plot([0, 1], [0, 1], color="#E69F00", label="A")
        line_b, = ax.plot([0, 1], [1, 0], color="#56B4E9", label="B")

        legend = style_presets.style_legend(ax, color_text=False)
        self.assertTrue(legend.get_frame_on())
        self.assertEqual(legend.get_frame().get_alpha(), 1)
        self.assertTrue(all(text.get_color() == "black" for text in legend.get_texts()))

        legend = style_presets.style_legend(ax, color_text=True)
        self.assertEqual([text.get_color() for text in legend.get_texts()], [line_a.get_color(), line_b.get_color()])
        plt.close(fig)

    def test_style_legend_colored_text_supports_bar_patch_handles(self):
        style_presets.rcparams()
        fig, ax = plt.subplots()
        bars = ax.bar([0, 1], [1, 2], color=["#E69F00", "#56B4E9"], label="bars")

        legend = style_presets.style_legend(ax, color_text=True)

        self.assertEqual(legend.get_texts()[0].get_color(), bars.patches[0].get_facecolor())
        plt.close(fig)

    def test_plot_scatter_only_creates_no_connecting_line_artists(self):
        style_presets.rcparams()
        fig, ax = plt.subplots()

        collection = style_presets.plot_scatter_only(ax, [0, 1, 2, 3], [1, 3, 2, 4], label="observations")

        self.assertIn(collection, ax.collections)
        self.assertEqual(len(ax.lines), 0)
        self.assertEqual(collection.get_label(), "observations")
        plt.close(fig)


if __name__ == "__main__":
    unittest.main()
