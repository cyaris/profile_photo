import argparse
import json
from pathlib import Path

from PIL import Image

from utils import initialize_logger

logger = initialize_logger(__name__)

REPO_ROOT: Path = Path(__file__).resolve().parents[2]
STATIC_DIR: Path = REPO_ROOT / "frontend" / "src" / "lib" / "static"
FAVICON_PATH: Path = STATIC_DIR / "favicon.png"
PIXELS_PATH: Path = STATIC_DIR / "pixels.json"


def positive_int(value: str) -> int:
    parsed_value = int(value)
    if parsed_value <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")

    return parsed_value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate JSON pixel data from the profile favicon.")
    parser.add_argument("--x-max", type=positive_int, default=48, help="Pixel width for the resized source image.")
    parser.add_argument("--y-max", type=positive_int, default=48, help="Pixel height for the resized source image.")

    return parser.parse_args()


def create_pixel_data(image: Image.Image, x_max: int, y_max: int) -> list[dict[str, int | str]]:
    image_small = image.convert("RGB").resize((x_max, y_max), resample=Image.BILINEAR)

    pixels: list[dict[str, int | str]] = []
    for x in range(x_max):
        for y in range(y_max):
            red, green, blue = image_small.getpixel((x, y))[:3]
            pixels.append({"x": x, "y": y, "id": f"x{x + 1}y{y + 1}", "rgb": f"rgb({red}, {green}, {blue})"})

    return pixels


def main() -> None:
    args = parse_args()
    x_max = args.x_max
    y_max = args.y_max

    logger.info("Opening source image at %s", FAVICON_PATH)
    with Image.open(FAVICON_PATH) as image:
        pixels = create_pixel_data(image, x_max, y_max)

    logger.info("Generating %s by %s pixel data", x_max, y_max)
    PIXELS_PATH.write_text(json.dumps(pixels), encoding="utf-8")
    logger.info("Wrote %s rows to %s", f"{len(pixels):,}", PIXELS_PATH)


if __name__ == "__main__":
    main()
