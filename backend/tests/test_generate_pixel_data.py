import argparse

import pytest
from PIL import Image

from generate_pixel_data import create_pixel_data, positive_int


def test_positive_int_accepts_positive_values_and_rejects_nonpositive_values() -> None:
    assert positive_int("3") == 3

    with pytest.raises(argparse.ArgumentTypeError, match="positive integer"):
        positive_int("0")


def test_create_pixel_data_preserves_column_major_order_and_rgb_values() -> None:
    image = Image.new("RGB", (2, 2))
    image.putdata([(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 255)])

    assert create_pixel_data(image, 2, 2) == [
        {"id": "x1y1", "rgb": "rgb(255, 0, 0)", "x": 0, "y": 0},
        {"id": "x1y2", "rgb": "rgb(0, 0, 255)", "x": 0, "y": 1},
        {"id": "x2y1", "rgb": "rgb(0, 255, 0)", "x": 1, "y": 0},
        {"id": "x2y2", "rgb": "rgb(255, 255, 255)", "x": 1, "y": 1},
    ]
