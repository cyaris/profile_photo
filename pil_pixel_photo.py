from PIL import Image
import numpy as np
import pandas as pd
from copy import deepcopy

# Open Paddington
img = Image.open("profile_photo.png")

# Resize smoothly down to 48x48 pixels
xMax = 48
yMax = 48
imgSmall = img.resize((48, 48), resample=Image.BILINEAR)

# Scale back up using NEAREST to original size
result = imgSmall.resize(img.size, Image.NEAREST)

# Save pixel photo
result.save("profile_photo_pixelated.png")

# creating a dataframe with rgb codes for each pixel.
pixel_df = pd.DataFrame()
row = 0
for x in np.arange(0, xMax):
    for y in np.arange(0, yMax):
        pixel_rgb = deepcopy(imgSmall.getpixel((int(x), int(y))))
        pixel_df.loc[row, "x_coordinate"] = x + 1
        pixel_df.loc[row, "y_coordinate"] = y + 1
        pixel_df.loc[row, "r"] = pixel_rgb[0]
        pixel_df.loc[row, "g"] = pixel_rgb[1]
        pixel_df.loc[row, "b"] = pixel_rgb[2]
        row += 1

pixel_df.to_json(orient="records", path_or_buf="proile_photo_pixel_rgb_codes.json")


xMax = 12
yMax = 12
hover_df = pd.DataFrame()
row = 0
for x in np.arange(0, xMax):
    for y in np.arange(0, yMax):
        hover_df.loc[row, "x_coordinate"] = x + 1
        hover_df.loc[row, "y_coordinate"] = y + 1
        row += 1

hover_df.to_json(orient="records", path_or_buf="proile_photo_hover_sections.json")
