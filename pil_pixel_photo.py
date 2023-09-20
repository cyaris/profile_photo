from PIL import Image
import pandas as pd
from copy import deepcopy

# Open Paddington
img = Image.open("./src/lib/static/favicon.png")

# Resize smoothly down to 48x48 pixels
xMax = 48
yMax = 48
imgSmall = img.resize((48, 48), resample=Image.BILINEAR)

# creating a dataframe with rgb codes for each pixel.
pixel_df = pd.DataFrame()
row = 0
for x in range(xMax):
    for y in range(yMax):
        pixel_rgb = deepcopy(imgSmall.getpixel((int(x), int(y))))
        pixel_df.loc[row, "x"] = x
        pixel_df.loc[row, "y"] = y
        pixel_df.loc[row, "id"] = "x" + str(x + 1) + "y" + str(y + 1)
        pixel_df.loc[row, "rgb"] = f"rgb({str(pixel_rgb[0])}, {str(pixel_rgb[1])}, {str(pixel_rgb[2])})"
        row += 1

pixel_df.to_json(orient="records", path_or_buf="./src/lib/static/pixels.json")
