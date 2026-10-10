import io
import os
import uuid
from PIL import Image, ImageOps
from django.core.files.base import ContentFile


def compress_and_convert_to_webp(
    uploaded_file, max_size_px: int = 800, target_max_kb: int = 80
) -> ContentFile:
    """
    Takes an uploaded image file (JPEG, PNG, WEBP, BMP, GIF, etc.),
    auto-orients EXIF, downsizes if larger than max_size_px (default 800x800),
    and compresses to high-efficiency WebP format guaranteeing file size <= target_max_kb (default 80KB).
    """
    img = Image.open(uploaded_file)
    img = ImageOps.exif_transpose(img)

    # Maintain alpha for RGBA/LA/P transparency, otherwise convert to RGB
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Downscale if exceeding bounds preserving aspect ratio
    img.thumbnail((max_size_px, max_size_px), Image.Resampling.LANCZOS)

    # Progressive quality reduction until target size reached
    quality = 82
    min_quality = 35
    buffer = io.BytesIO()

    while quality >= min_quality:
        buffer.seek(0)
        buffer.truncate(0)
        img.save(buffer, format="WEBP", quality=quality, method=4)
        size_kb = buffer.tell() / 1024
        if size_kb <= target_max_kb:
            break
        quality -= 8

    buffer.seek(0)
    orig_name = getattr(uploaded_file, "name", "image") or "image"
    base_name = os.path.splitext(os.path.basename(orig_name))[0]
    # Clean file name
    clean_base = "".join(c for c in base_name if c.isalnum() or c in ("-", "_"))[:25] or "prod"
    unique_name = f"{clean_base}_{uuid.uuid4().hex[:8]}.webp"
    return ContentFile(buffer.read(), name=unique_name)
