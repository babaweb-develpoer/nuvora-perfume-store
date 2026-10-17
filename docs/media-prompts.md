# Media Prompt Pack: Nuvora (concept perfume store)

This file has every image and video prompt the site needs. Each prompt is ready to copy and paste into **Google Flow**: Veo for video, and Nano Banana or Imagen for images.

- **36 files to generate:** 32 images and 4 videos.
- **4 files to export, not generate:** the video poster frames.
- **8 helper images, for you only:** 4 house reference bottles and 4 video start frames. They live in `media-refs/` and are never added to the site.
- **The site works before you start.** Until a file exists, the site shows a styled placeholder in its slot. Drop each finished file in with its **exact filename** and it appears on the page.

The four perfume houses (Maison Noor, Velluto Nero, Aurelle, Sahara Royale) are made up. **No real brand names, logos or readable text should appear in any image or video.**

---

## 1. How to use

### 1.1 Order of generation (follow this order)

1. **Make 4 house reference bottles** (section 4). They are not used on the site. They lock in each bottle design, so every later image shows the same bottle.
2. **Make the 12 product images** (`product-*`), using each house's reference bottle as a reference image.
3. **Make the 2 hero images** (`hero-1`, `hero-2`).
4. **Make the category images** (`cat-*`).
5. **Make the lifestyle, about, banner and gift images.**
6. **Make the Open Graph image** (`og`). This is the preview image that appears when someone shares a link to the site.
7. **Make the 4 video start frames** (section 5.2, "Video start frames"). These are helper images saved in `media-refs/`, not site files. Each one is composed at 16:9 to match its video scene exactly.
8. **Make the 4 videos** with Frames to Video, using each video's own start frame.
9. **Export the 4 poster frames** from the finished videos (section 1.5). Do not generate them.

**What each step needs first:**

| You are making | It needs |
|---|---|
| Products, heroes, categories, scenes, og | The house reference bottles (step 1) |
| `start-hero-video`, `start-gift-video` | The Maison Noor reference bottle |
| `start-scent-video`, `start-about-video` | Nothing (no bottle appears in them) |
| Each video | Its own start frame (step 7) |
| Each poster | Its finished video (step 8) |

No video uses a site image as its start frame. Site images are cropped to other shapes (4:5, 3:2), so a crop of one would not match the 16:9 video scene.

### 1.2 Recommended models (Google Flow)

| Use | Model | Why |
|---|---|---|
| Anything showing a house bottle (products, hero, categories, most scenes) | **Nano Banana** (use Nano Banana Pro if your plan has it) | It follows reference images closely, so the bottle stays the same across shots |
| Scenes with no specific bottle (`about-2`, `about-3`) | **Imagen 4** (or Nano Banana) | Strong photoreal texture and lighting |
| Videos | **Veo 3.1** in **Frames to Video** mode (Quality if available, otherwise Fast) | A start frame keeps the bottle consistent. If your plan lets you set a last frame, use the same image as the first frame for a seamless loop |

Make 2 to 4 variations of each prompt and keep the best one. Change the prompt only when every variation shows the same problem.

### 1.3 Aspect ratios and sizes

Use the exact aspect ratio if the model offers it. Nano Banana supports 1:1, 16:9, 4:5, 3:2 and 21:9. If it doesn't, generate at the **fallback** ratio and crop with the commands in 1.6.

| Group | Final aspect | Fallback, then crop | Final pixel size |
|---|---|---|---|
| Hero images | 16:9 | none | 2560 × 1440 |
| Products | 1:1 | none (generate at **2048 × 2048**) | 2048 × 2048 |
| Categories | 4:5 | 3:4, crop to 4:5 | 1600 × 2000 |
| Lifestyle | 4:5 | 3:4, crop to 4:5 | 1600 × 2000 |
| About | 3:2 | 4:3 or 16:9, crop to 3:2 | 2400 × 1600 |
| Banners | 21:9 | **16:9, crop to the centre 21:9 band** (keep the subject vertically centred) | 2560 × 1097 |
| Gift | 4:5 | 3:4, crop to 4:5 | 1600 × 2000 |
| Open Graph | 1.91:1 | 16:9, crop to 1.91:1 | 1200 × 630 |
| Videos | 16:9 | none | 1920 × 1080, 8 s, MP4 (H.264), no audio |
| Posters | 16:9 | exported from the video | 1920 × 1080 |

### 1.4 File naming and where to put the files

- Images: save as **JPG** in `assets/img/`, using the exact filename from the table in section 3. Use lowercase with hyphens only.
- Videos: save as **MP4** in `assets/video/`, using the exact filename from the table.
- Image size targets: about 250–450 KB for products and cards, and under 700 KB for hero and banner images. Use JPEG quality 80–85 and the sRGB colour profile.
- Video size target: under about 6 MB each. Use the compression command in 1.6.
- Keep the 4 house reference bottles and the 4 video start frames **outside** the site folders, for example in a `media-refs/` folder on your desktop. They are only for you.

### 1.5 Exporting the poster frames (do not generate them)

A poster is the still image the browser shows before a video starts playing. Each poster should be the **first frame** of its video, so nothing visibly jumps when playback begins.

With ffmpeg, a free command-line tool (run these from the project folder):

```
ffmpeg -y -ss 0 -i assets/video/hero-video.mp4  -frames:v 1 -q:v 3 assets/img/poster-hero-video.jpg
ffmpeg -y -ss 0 -i assets/video/scent-video.mp4 -frames:v 1 -q:v 3 assets/img/poster-scent-video.jpg
ffmpeg -y -ss 0 -i assets/video/about-video.mp4 -frames:v 1 -q:v 3 assets/img/poster-about-video.jpg
ffmpeg -y -ss 0 -i assets/video/gift-video.mp4  -frames:v 1 -q:v 3 assets/img/poster-gift-video.jpg
```

Without ffmpeg:

1. Open the video in a player (VLC or the Windows Photos app). Pause on the very first frame and take a full-screen screenshot.
2. Crop the screenshot to the video area, 16:9.
3. Save it as a JPG with the matching `poster-…` filename.

### 1.6 Handy ffmpeg commands (optional)

Change `downloaded.png` to the name of the file you downloaded from Flow.

```
# Convert a PNG download to JPG (no crop)
ffmpeg -y -i downloaded.png -q:v 3 assets/img/hero-1.jpg

# Crop 3:4 to 4:5 (categories, lifestyle, gift)
ffmpeg -y -i downloaded.png -vf "crop=iw:iw*5/4,scale=1600:2000" -q:v 3 assets/img/cat-men.jpg

# Crop 4:3 or 16:9 to 3:2 (about)
ffmpeg -y -i downloaded.png -vf "crop=min(iw\,ih*3/2):min(ih\,iw*2/3),scale=2400:1600" -q:v 3 assets/img/about-1.jpg

# Crop 16:9 to the centre 21:9 band (banners)
ffmpeg -y -i downloaded.png -vf "crop=iw:iw*9/21,scale=2560:1097" -q:v 3 assets/img/banner-1.jpg

# Crop 16:9 to 1.91:1 (Open Graph)
ffmpeg -y -i downloaded.png -vf "crop=iw:iw/1.91,scale=1200:630" -q:v 3 assets/img/og.jpg

# Compress a Veo download for the web: strip audio, web-friendly MP4, about 3-6 MB
ffmpeg -y -i downloaded.mp4 -an -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -vf "scale=1920:-2" assets/video/hero-video.mp4

# Fallback if a video's last frame doesn't match its first frame (visible jump when it loops):
# play the clip forwards then backwards (a "boomerang"), giving a 16 s clip that loops seamlessly
ffmpeg -y -i downloaded.mp4 -filter_complex "[0:v]reverse[r];[0:v][r]concat=n=2:v=1[v]" -map "[v]" -an -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart assets/video/gift-video.mp4
```

### 1.7 If stray text or logos appear

Image and video models sometimes draw the very things a prompt mentions, even after "no". This is why the style block is worded positively.

- **Symptom:** stray letters or glyph-like squiggles on a bottle or box, fake signage on a wall, a corner "watermark", or a logo-like mark on the cap.
- **Fix:**
  1. If the tool has a **negative prompt field**, move the prompt's "Avoid:" line into it, delete it from the main prompt, and regenerate.
  2. If there is no negative field, try deleting the "Avoid:" line completely and regenerate. The positive style block often works better on its own.
  3. If text still appears on one small area, use the tool's edit or inpaint feature on that area with the prompt "smooth blank glass" (or "smooth blank surface").
- Never keep an image with readable or half-readable text. Fake text looks cheap up close.

---

## 2. Shared style and rules

### 2.1 STYLE BLOCK (put this at the start of every prompt)

Every prompt in section 5 already includes this block. You only need it if you write a new prompt. The block describes what you *do* want (blank, unmarked surfaces) rather than naming text and logos. Naming them can sometimes cause the model to draw them. The explicit "don'ts" live in the Avoid line (2.3).

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.
```

### 2.2 VIDEO ADD-ON (already included in every video prompt)

```
Cinematic 8-second shot, 24 fps, slow and graceful motion, one continuous take with no cuts. Loop-friendly: the first and last frames match in composition, lighting and subject position, so the clip loops seamlessly. Clean, unmarked frame throughout with no on-screen graphics; people appear only as hands. Quiet ambient sound only (it will be muted on the website).
```

### 2.3 Avoid / negative prompt (one line)

Every prompt below ends with a short "Avoid:" line. How to use it depends on your tool (see also 1.7):

- **If the tool has a negative prompt field:** cut the "Avoid:" line out of the main prompt and paste it, or the full line below, into the negative field. Do not leave it in both places.
- **If there is no negative field:** leave the "Avoid:" line at the end of the prompt as written.

```
text, letters, words, numbers, label typography, logos, brand names, watermark, signature, extra or duplicated bottles, warped or melted glass, crooked caps, floating objects, plastic or CGI look, harsh flash, white or grey background, oversaturated colours, neon, clutter, faces, identifiable people, extra fingers, deformed hands
```

### 2.4 Scene rules (lifestyle, about, banners, gift)

- Aim for a Pakistani and Gulf luxury feel that stays understated. Good details: shadows from Mughal arches and jali screens (carved lattice), brass trays, oud smoke, silk, rose petals, jasmine (motia), marble vanities, candlelight.
- **No identifiable people.** Show hands only, or a silhouette, and never a face. A delicate gold ring or bangle on the hand is fine.
- No shop signs, price tags, packaging text or readable text of any kind.

---

## 3. Every slot at a glance

> **These tables are the original plan, not what shipped.** Banners, categories, lifestyle, gift and about images were delivered in other shapes and sizes, and the posters are 1280 × 720. For what is actually on the site read the [Delivery notes](#delivery-notes-tasks-17-and-17c-october-2026) at the end of this file (and `assets/js/media-manifest.js`, which the tests check against the files).

All 40 site files, with the size to make each one.

| Slot id | File | Aspect | Size | How to make it |
|---|---|---|---|---|
| hero-1 | `assets/img/hero-1.jpg` | 16:9 | 2560 × 1440 | generate |
| hero-2 | `assets/img/hero-2.jpg` | 16:9 | 2560 × 1440 | generate |
| hero-video | `assets/video/hero-video.mp4` | 16:9 | 1920 × 1080, 8 s | generate (Veo) |
| scent-video | `assets/video/scent-video.mp4` | 16:9 | 1920 × 1080, 8 s | generate (Veo) |
| about-video | `assets/video/about-video.mp4` | 16:9 | 1920 × 1080, 8 s | generate (Veo) |
| gift-video | `assets/video/gift-video.mp4` | 16:9 | 1920 × 1080, 8 s | generate (Veo) |
| poster-hero-video | `assets/img/poster-hero-video.jpg` | 16:9 | 1920 × 1080 | **export the first frame** |
| poster-scent-video | `assets/img/poster-scent-video.jpg` | 16:9 | 1920 × 1080 | **export the first frame** |
| poster-about-video | `assets/img/poster-about-video.jpg` | 16:9 | 1920 × 1080 | **export the first frame** |
| poster-gift-video | `assets/img/poster-gift-video.jpg` | 16:9 | 1920 × 1080 | **export the first frame** |
| product-mn-01 | `assets/img/product-mn-01.jpg` | 1:1 | 2048 × 2048 | generate (Maison Noor reference) |
| product-mn-02 | `assets/img/product-mn-02.jpg` | 1:1 | 2048 × 2048 | generate (Maison Noor reference) |
| product-mn-03 | `assets/img/product-mn-03.jpg` | 1:1 | 2048 × 2048 | generate (Maison Noor reference) |
| product-vn-01 | `assets/img/product-vn-01.jpg` | 1:1 | 2048 × 2048 | generate (Velluto Nero reference) |
| product-vn-02 | `assets/img/product-vn-02.jpg` | 1:1 | 2048 × 2048 | generate (Velluto Nero reference) |
| product-vn-03 | `assets/img/product-vn-03.jpg` | 1:1 | 2048 × 2048 | generate (Velluto Nero reference) |
| product-au-01 | `assets/img/product-au-01.jpg` | 1:1 | 2048 × 2048 | generate (Aurelle reference) |
| product-au-02 | `assets/img/product-au-02.jpg` | 1:1 | 2048 × 2048 | generate (Aurelle reference) |
| product-au-03 | `assets/img/product-au-03.jpg` | 1:1 | 2048 × 2048 | generate (Aurelle reference) |
| product-sr-01 | `assets/img/product-sr-01.jpg` | 1:1 | 2048 × 2048 | generate (Sahara Royale reference) |
| product-sr-02 | `assets/img/product-sr-02.jpg` | 1:1 | 2048 × 2048 | generate (Sahara Royale reference) |
| product-sr-03 | `assets/img/product-sr-03.jpg` | 1:1 | 2048 × 2048 | generate (Sahara Royale reference) |
| cat-men | `assets/img/cat-men.jpg` | 4:5 | 1600 × 2000 | generate |
| cat-women | `assets/img/cat-women.jpg` | 4:5 | 1600 × 2000 | generate |
| cat-unisex-oud | `assets/img/cat-unisex-oud.jpg` | 4:5 | 1600 × 2000 | generate |
| cat-gift | `assets/img/cat-gift.jpg` | 4:5 | 1600 × 2000 | generate |
| lifestyle-1 | `assets/img/lifestyle-1.jpg` | 4:5 | 1600 × 2000 | generate |
| lifestyle-2 | `assets/img/lifestyle-2.jpg` | 4:5 | 1600 × 2000 | generate |
| lifestyle-3 | `assets/img/lifestyle-3.jpg` | 4:5 | 1600 × 2000 | generate |
| lifestyle-4 | `assets/img/lifestyle-4.jpg` | 4:5 | 1600 × 2000 | generate |
| about-1 | `assets/img/about-1.jpg` | 3:2 | 2400 × 1600 | generate |
| about-2 | `assets/img/about-2.jpg` | 3:2 | 2400 × 1600 | generate |
| about-3 | `assets/img/about-3.jpg` | 3:2 | 2400 × 1600 | generate |
| banner-1 | `assets/img/banner-1.jpg` | 21:9 | 2560 × 1097 | generate (or make 16:9 and crop) |
| banner-2 | `assets/img/banner-2.jpg` | 21:9 | 2560 × 1097 | generate (or make 16:9 and crop) |
| banner-3 | `assets/img/banner-3.jpg` | 21:9 | 2560 × 1097 | generate (or make 16:9 and crop) |
| banner-4 | `assets/img/banner-4.jpg` | 21:9 | 2560 × 1097 | generate (or make 16:9 and crop) |
| gift-1 | `assets/img/gift-1.jpg` | 4:5 | 1600 × 2000 | generate |
| gift-2 | `assets/img/gift-2.jpg` | 4:5 | 1600 × 2000 | generate |
| og | `assets/img/og.jpg` | 1.91:1 | 1200 × 630 | generate at 16:9, then crop |

---

## 4. Consistency: generate one reference bottle per house first

Every image of a house's bottle has to show the same bottle. The most reliable way to get that is to generate **one clean reference image per house** first. Then attach it as a **reference image** (also called an ingredient) every time that bottle appears.

**How to do it**

1. Generate each reference prompt below at 1:1. Pick the version with the cleanest, most symmetrical bottle and a front with nothing written on it.
2. Save it outside the site folder, for example `media-refs/ref-maison-noor.png`.
3. Whenever a prompt says **Reference: <house>**, attach that image and keep the words *"the exact same bottle as the reference image"* in the prompt. These are already written into the prompts.
4. If a result changes the bottle's shape, cap or colour, generate it again. Don't settle for a different bottle.

**Bottle designs (do not change these)**

| House | Bottle |
|---|---|
| Maison Noor | Tall rectangular bottle in deep amber glass with thick bevelled edges and a heavy clear-glass base, topped with a faceted polished-gold cap. Arabian-luxury mood. |
| Velluto Nero | Squat cylindrical bottle in matte black glass with a brushed-gold collar at the neck and a flat matte-black cap. |
| Aurelle | Clear faceted bottle cut like a gemstone, filled with blush-pink liquid, with a slim rose-gold ring at the neck and a faceted clear-glass stopper. |
| Sahara Royale | Softly rounded flask-shaped bottle in pale teal glass with a brushed-silver cap. |

**Labels:** the front of every bottle is **completely blank**. At most it can carry a tiny abstract embossed geometric emblem with no letters. AI models are bad at drawing text, so we never ask for any.

### REF: Maison Noor (save as `media-refs/ref-maison-noor.png`, not used on the site)

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Product reference shot: a single tall rectangular perfume bottle of deep amber glass with thick bevelled edges and a heavy clear-glass base, topped with a faceted polished-gold cap. The front face is smooth and completely blank. The bottle stands perfectly upright and centred, seen straight-on from the front at eye level, on a seamless near-black studio backdrop with a faint reflection on a black glossy surface. Square 1:1 composition, bottle filling about 65% of the frame height, symmetrical, Arabian-luxury mood.

Avoid: text, letters, logos, watermark, extra bottles, warped glass, crooked cap, props.
```

### REF: Velluto Nero (save as `media-refs/ref-velluto-nero.png`)

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Product reference shot: a single squat cylindrical perfume bottle in matte black glass with a brushed-gold collar at the neck and a flat matte-black cap. The front is smooth and completely blank. The gold rim light carves the bottle's silhouette out of the dark background. The bottle stands upright and centred, straight-on at eye level, on a seamless near-black studio backdrop with a subtle reflection on black glossy stone. Square 1:1 composition, bottle filling about 60% of the frame height, symmetrical, moody and masculine.

Avoid: text, letters, logos, watermark, extra bottles, glossy plastic look, crooked collar, props.
```

### REF: Aurelle (save as `media-refs/ref-aurelle.png`)

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Product reference shot: a single clear faceted perfume bottle cut like a gemstone, filled with luminous blush-pink liquid, with a slim rose-gold ring at the neck and a faceted clear-glass stopper. The glass is smooth and completely unmarked. Light refracts through the facets, casting small pink and gold caustic glints. The bottle stands upright and centred, straight-on at eye level, on a seamless near-black studio backdrop with a soft reflection on black glass. Square 1:1 composition, bottle filling about 60% of the frame height, symmetrical, feminine and refined.

Avoid: text, letters, logos, watermark, extra bottles, cloudy glass, warped facets, props.
```

### REF: Sahara Royale (save as `media-refs/ref-sahara-royale.png`)

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Product reference shot: a single softly rounded flask-shaped perfume bottle in pale teal glass with a brushed-silver cap. The front is smooth and completely blank. A gentle teal glow passes through the glass and the gold rim light traces its curves. The bottle stands upright and centred, straight-on at eye level, on a seamless near-black studio backdrop with a soft reflection on black stone. Square 1:1 composition, bottle filling about 60% of the frame height, symmetrical, fresh yet luxurious.

Avoid: text, letters, logos, watermark, extra bottles, saturated turquoise, warped glass, props.
```

---

## 5. Prompts by slot

### 5.1 Hero images (16:9, 2560 × 1440)

The site places its headline on the **left** side of the hero. Keep the left 40% of these images as clean dark space.

#### hero-1: the four houses
`assets/img/hero-1.jpg` · 16:9 · 2560 × 1440 · Reference: all four house references (attach all four)

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Wide 16:9 hero image: the four exact bottles from the reference images (the amber glass bottle with gold cap, the matte black bottle with gold collar, the faceted pink bottle with rose-gold ring, and the pale teal bottle with silver cap) stand in a loose staggered group on a polished black marble slab with fine gold veining. The group sits in the right half of the frame. The left 40% of the frame is clean, dark, empty negative space for a headline. A thin wisp of smoke drifts behind the bottles and a low gold glow rises from the horizon line. Camera slightly below bottle height, 85mm lens look, all bottle fronts blank.

Avoid: text, letters, logos, watermark, extra bottles, duplicated bottles, warped glass, clutter on the left side.
```

#### hero-2: oud ritual
`assets/img/hero-2.jpg` · 16:9 · 2560 × 1440 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Wide 16:9 hero image: the exact same bottle as the reference image (tall deep-amber glass bottle with faceted polished-gold cap, blank front) stands on an engraved antique brass tray, beside a small brass incense burner releasing a slow curl of oud smoke. A few deep crimson rose petals are scattered on the tray. Behind, on a dark plaster wall, falls the soft shadow of a Mughal pointed arch. The subject group sits in the right third of the frame and the left 40% is calm, dark negative space for a headline. Warm candle-like key light from the right, 85mm lens look.

Avoid: text, letters, logos, watermark, extra bottles, people, harsh flash, clutter on the left side.
```

### 5.2 Videos (16:9, 1920 × 1080, 8 seconds, loop-friendly)

Each video comes in two steps:

1. **Generate its start frame:** a 16:9 helper image saved in `media-refs/`. It is not a site file.
2. **Generate the video:** use **Veo 3.1, Frames to Video**, and set that image as the start frame. If your plan also lets you set an end frame, use the **same image** for both, so the clip loops seamlessly.

Each video scene describes exactly what is in its start frame, then adds only motion. Every camera move goes out and comes back to its starting position. After downloading, run the compression command from 1.6, then export the poster (1.5).

#### Video start frames (helper images, not site files)

Generate these at **16:9** with Nano Banana. Save them as PNG in `media-refs/`. They are **not** among the 32 site images and are never uploaded to the site.

##### START: hero-video (save as `media-refs/start-hero-video.png`) · 16:9 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Wide 16:9 video start frame: the exact same bottle as the reference image (tall rectangular deep-amber glass bottle with thick bevelled edges and a faceted polished-gold cap, smooth blank front) stands upright on polished black marble with fine gold veining. It is placed right of centre, about two-thirds of the way across the frame, seen at eye level with an 85mm lens look and a faint reflection in the marble. The left 45% of the frame is calm, dark, empty space. A few thin ribbons of oud smoke hang in the dark background. Only the bottle, the marble and the smoke are in frame.

Avoid: text, letters, logos, watermark, extra bottles, props, tray, flowers, warped glass.
```

##### START: scent-video (save as `media-refs/start-scent-video.png`) · 16:9 · No reference needed

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Wide 16:9 video start frame, macro still life: perfume ingredients float weightlessly in dark space, spread loosely across the whole frame at different depths. There are dark resinous oud wood chips, deep red rose petals, fine threads of saffron and glowing translucent chunks of amber resin. A few pieces in the centre are in sharp focus and the rest melt into soft bokeh. Two soft diagonal shafts of warm gold light cross the frame, and fine wisps of smoke curl between the ingredients. There are no surfaces and no objects other than the ingredients.

Avoid: text, letters, logos, watermark, bottles, hands, table or surface, bright background, clutter.
```

##### START: about-video (save as `media-refs/start-about-video.png`) · 16:9 · No reference needed

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Wide 16:9 video start frame: a quiet perfumer's atelier at night with no people. On a dark walnut workbench, small unmarked glass vials of amber and golden oils stand in a brass rack beside an antique brass scale, a glass pipette resting on a brass dish, and a lit candle. Soft light through a carved jali lattice window on the left throws a delicate geometric shadow pattern across the bench. A thin thread of smoke rises from the candle and fine dust motes hang in the light beam. Eye-level tripod view of the bench, filling the frame.

Avoid: text, letters, labels with writing, logos, watermark, people, hands, faces, clutter.
```

##### START: gift-video (save as `media-refs/start-gift-video.png`) · 16:9 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Wide 16:9 video start frame, slightly high angle: an open matte-black gift box lined with ivory satin sits slightly right of centre on an engraved brass tray, which rests on dark marble. Nestled upright in the satin is the exact same bottle as the reference image (tall deep-amber glass bottle with a faceted polished-gold cap, smooth blank front). The box lid leans against the back edge of the box. A loosened gold silk ribbon drapes in soft loops beside the box on the tray, and a few deep red rose petals are scattered around it. There is dark, calm space around the group with room for hands to enter from the right. No hands are in frame yet.

Avoid: text, letters, logos, gift tags with writing, watermark, extra bottles, people, hands, clutter.
```

#### hero-video: bottle in smoke
`assets/video/hero-video.mp4` · 16:9 · 1920 × 1080 · 8 s · Start frame (and end frame if available): `media-refs/start-hero-video.png`

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Cinematic 8-second shot, 24 fps, slow and graceful motion, one continuous take with no cuts. Loop-friendly: the first and last frames match in composition, lighting and subject position, so the clip loops seamlessly. Clean, unmarked frame throughout with no on-screen graphics; people appear only as hands. Quiet ambient sound only (it will be muted on the website).

Scene, exactly as in the start frame: the tall deep-amber glass perfume bottle with faceted polished-gold cap and smooth blank front stands on polished black marble, right of centre, with calm dark empty space on the left and thin ribbons of oud smoke in the background. Camera move: a very slow arc of about 15 degrees to the right over the first 4 seconds, easing smoothly back to the exact starting position by 8 seconds. The smoke drifts gently and a soft band of gold light glides across the glass and back, making the amber liquid glow. Nothing enters or leaves the frame.

Avoid: text, logos, watermark, extra bottles, morphing glass, new props, fast motion, cuts, people.
```

#### scent-video: the scent story
`assets/video/scent-video.mp4` · 16:9 · 1920 × 1080 · 8 s · Start frame (and end frame if available): `media-refs/start-scent-video.png`

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Cinematic 8-second shot, 24 fps, slow and graceful motion, one continuous take with no cuts. Loop-friendly: the first and last frames match in composition, lighting and subject position, so the clip loops seamlessly. Clean, unmarked frame throughout with no on-screen graphics; people appear only as hands. Quiet ambient sound only (it will be muted on the website).

Scene, exactly as in the start frame: oud wood chips, deep red rose petals, saffron threads and glowing amber resin float weightlessly in dark space, crossed by soft shafts of warm gold light and fine wisps of smoke. Motion: each ingredient stays in its own place, bobbing very gently up and down and slowly turning a little, then settling back to where it began. Camera move: a slow sideways drift to the right over the first 4 seconds, easing smoothly back to the exact starting position by 8 seconds. Nothing drifts out of frame and nothing new enters.

Avoid: text, logos, watermark, bottles, hands, falling or flying-away ingredients, fast motion, cuts, bright background.
```

#### about-video: atelier ambience
`assets/video/about-video.mp4` · 16:9 · 1920 × 1080 · 8 s · Start frame (and end frame if available): `media-refs/start-about-video.png`

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Cinematic 8-second shot, 24 fps, slow and graceful motion, one continuous take with no cuts. Loop-friendly: the first and last frames match in composition, lighting and subject position, so the clip loops seamlessly. Clean, unmarked frame throughout with no on-screen graphics; people appear only as hands. Quiet ambient sound only (it will be muted on the website).

Scene, exactly as in the start frame: a quiet perfumer's atelier at night with no people. On a dark walnut workbench stand small unmarked glass vials of amber oils in a brass rack, an antique brass scale, a glass pipette on a brass dish and a lit candle, with a jali lattice shadow pattern across the bench. Gentle movement only: the candle flame flickers, a thin thread of smoke rises and curls, and dust motes float slowly in the light beam. Camera move: a locked-off tripod shot with an almost imperceptible drift forward over 4 seconds and back to the exact starting position by 8 seconds.

Avoid: text, logos, labels with writing, watermark, people, hands, faces, fast motion, cuts.
```

#### gift-video: the gift reveal
`assets/video/gift-video.mp4` · 16:9 · 1920 × 1080 · 8 s · Start frame (and end frame if available): `media-refs/start-gift-video.png` · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Cinematic 8-second shot, 24 fps, slow and graceful motion, one continuous take with no cuts. Loop-friendly: the first and last frames match in composition, lighting and subject position, so the clip loops seamlessly. Clean, unmarked frame throughout with no on-screen graphics; people appear only as hands. Quiet ambient sound only (it will be muted on the website).

Scene, exactly as in the start frame: an open matte-black gift box lined with ivory satin sits on an engraved brass tray on dark marble, with its lid leaning against the back edge of the box, a loosened gold silk ribbon draped beside it and a few deep red rose petals scattered around. Nestled in the satin is the tall deep-amber glass perfume bottle with faceted polished-gold cap and smooth blank front. Action: two elegant hands (only hands and wrists, no face, a thin gold ring) enter from the right, gently lift the bottle a few centimetres to present it to the camera, and turn it slightly so the gold light catches the glass. They then set it back in exactly the same place in the satin and withdraw out of frame to the right. The lid, ribbon and petals never move. The final frame matches the first. Camera: locked-off, slightly high angle.

Avoid: text, logos, watermark, faces, extra fingers, deformed hands, extra bottles, moving lid, fast motion, cuts.
```

#### Poster frames: export these, do not generate them

Export the first frame of each video (commands in 1.5):

- `assets/img/poster-hero-video.jpg` from `assets/video/hero-video.mp4`
- `assets/img/poster-scent-video.jpg` from `assets/video/scent-video.mp4`
- `assets/img/poster-about-video.jpg` from `assets/video/about-video.mp4`
- `assets/img/poster-gift-video.jpg` from `assets/video/gift-video.mp4`

### 5.3 Product images (1:1, generate at 2048 × 2048)

Composition rules for all 12 products, so the shop grid looks like one set:

- The bottle is centred, seen at a slight three-quarter angle, with the camera a little below bottle height.
- The bottle fills about 60% of the frame height, with generous dark margins on every side.
- Props are small and stay low at the base of the bottle.
- Always attach that house's reference image.

#### product-mn-01: Oud Royale (Maison Noor)
`assets/img/product-mn-01.jpg` · 1:1 · 2048 × 2048 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: tall rectangular deep-amber glass bottle with thick bevelled edges and a faceted polished-gold cap, blank front with no label. It stands centred on a slab of polished black marble against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. A few dark, resinous oud wood chips lie at its base and a single thin curl of incense smoke rises behind it. Rich, regal, Arabian-luxury mood. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, warped glass, crooked cap, clutter.
```

#### product-mn-02: Amber Nights (Maison Noor)
`assets/img/product-mn-02.jpg` · 1:1 · 2048 × 2048 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: tall rectangular deep-amber glass bottle with thick bevelled edges and a faceted polished-gold cap, blank front with no label. It stands centred on polished black marble against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. Several translucent chunks of raw amber resin glow honey-gold at its base, and soft out-of-focus candle bokeh glimmers far behind. Warm, sensual, night-time mood. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, warped glass, crooked cap, clutter.
```

#### product-mn-03: Rose Oud (Maison Noor)
`assets/img/product-mn-03.jpg` · 1:1 · 2048 × 2048 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: tall rectangular deep-amber glass bottle with thick bevelled edges and a faceted polished-gold cap, blank front with no label. It stands centred on polished black marble against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. Deep crimson rose petals and two small oud wood chips rest at its base, one petal leaning softly against the glass. Romantic yet dark and opulent. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, warped glass, bright pink, clutter.
```

#### product-vn-01: Black Leather (Velluto Nero)
`assets/img/product-vn-01.jpg` · 1:1 · 2048 × 2048 · Reference: Velluto Nero

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: squat cylindrical matte black glass bottle with a brushed-gold collar and flat matte-black cap, blank front with no label. It stands centred on a dark slate surface against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. A folded piece of supple black leather with a fine gold-thread stitched edge lies at its base. Strong gold rim light separates the black bottle from the dark background. Bold, masculine, sophisticated. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, glossy plastic look, brand stamps on leather, clutter.
```

#### product-vn-02: Cedar & Smoke (Velluto Nero)
`assets/img/product-vn-02.jpg` · 1:1 · 2048 × 2048 · Reference: Velluto Nero

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: squat cylindrical matte black glass bottle with a brushed-gold collar and flat matte-black cap, blank front with no label. It stands centred on a dark slate surface against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. A split block of raw cedar wood with visible grain sits beside it, and a soft grey ribbon of smoke drifts across the background. Earthy, smoky, refined. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, glossy plastic look, fire, clutter.
```

#### product-vn-03: Midnight Vetiver (Velluto Nero)
`assets/img/product-vn-03.jpg` · 1:1 · 2048 × 2048 · Reference: Velluto Nero

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: squat cylindrical matte black glass bottle with a brushed-gold collar and flat matte-black cap, blank front with no label. It stands centred on a dark slate surface against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. A small tied bundle of dried vetiver roots lies at its base. Besides the gold rim light, a faint cool midnight-blue fill light touches the shadow side. Mysterious, nocturnal, elegant. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, strong blue cast, glossy plastic look, clutter.
```

#### product-au-01: Rose Eternelle (Aurelle)
`assets/img/product-au-01.jpg` · 1:1 · 2048 × 2048 · Reference: Aurelle

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: clear faceted gemstone-cut glass bottle filled with blush-pink liquid, slim rose-gold ring at the neck, faceted clear stopper, no label. It stands centred on a fold of ivory silk against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. Two soft pale-pink rose heads and a few loose petals rest at its base, and light refracts through the facets in tiny pink-gold glints. Romantic, timeless, feminine. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, cloudy glass, hot pink, clutter.
```

#### product-au-02: Jasmine Silk (Aurelle)
`assets/img/product-au-02.jpg` · 1:1 · 2048 × 2048 · Reference: Aurelle

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: clear faceted gemstone-cut glass bottle filled with blush-pink liquid, slim rose-gold ring at the neck, faceted clear stopper, no label. It stands centred on softly draped champagne-coloured silk against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. A short strand of small white jasmine (motia) blossoms curls around its base. Delicate, luminous, serene. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, cloudy glass, bright white background, clutter.
```

#### product-au-03: Peony Blush (Aurelle)
`assets/img/product-au-03.jpg` · 1:1 · 2048 × 2048 · Reference: Aurelle

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: clear faceted gemstone-cut glass bottle filled with blush-pink liquid, slim rose-gold ring at the neck, faceted clear stopper, no label. It stands centred on a polished black surface against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. One large, softly opened blush peony bloom sits just behind and to the side, slightly out of focus, with a single fallen petal in front. Soft, youthful, graceful. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, cloudy glass, hot pink, clutter.
```

#### product-sr-01: Citrus Dune (Sahara Royale)
`assets/img/product-sr-01.jpg` · 1:1 · 2048 × 2048 · Reference: Sahara Royale

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: softly rounded flask-shaped pale teal glass bottle with a brushed-silver cap, blank front with no label. It stands centred on a small mound of fine dark-gold sand with wind ripples, against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. Two thin slices of orange and a twist of citrus peel lie at its base, catching the gold light. Fresh, sunny, desert-luxury. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, saturated turquoise, bright daylight background, clutter.
```

#### product-sr-02: Aqua Oasis (Sahara Royale)
`assets/img/product-sr-02.jpg` · 1:1 · 2048 × 2048 · Reference: Sahara Royale

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: softly rounded flask-shaped pale teal glass bottle with a brushed-silver cap, blank front with no label. It stands centred in a thin, still layer of dark water on black stone, with a perfect mirror reflection and a few fine water droplets beading on the glass, against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. The soft shadow of a palm frond falls across the background. Cool, fresh, oasis calm. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, splashes, saturated turquoise, clutter.
```

#### product-sr-03: Bergamot Breeze (Sahara Royale)
`assets/img/product-sr-03.jpg` · 1:1 · 2048 × 2048 · Reference: Sahara Royale

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Square product photograph of the exact same bottle as the reference image: softly rounded flask-shaped pale teal glass bottle with a brushed-silver cap, blank front with no label. It stands centred on a polished black surface against a seamless near-black backdrop, seen at a slight three-quarter angle from just below bottle height. A whole green-yellow bergamot fruit and a few fresh mint leaves sit at its base, and a sheer ivory linen fabric drifts softly behind as if lifted by a breeze. Airy, crisp, elegant. Bottle fills about 60% of the frame height.

Avoid: text, letters, logos, watermark, extra bottles, saturated turquoise, bright background, clutter.
```

### 5.4 Category images (4:5, 1600 × 2000)

Category cards may have a label added on top at the **bottom** of the card. Keep the lower 25% of these images calm and dark.

#### cat-men
`assets/img/cat-men.jpg` · 4:5 · 1600 × 2000 · Reference: Velluto Nero

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 image: the exact same bottle as the reference image (squat matte black glass bottle with brushed-gold collar, blank front) stands in the upper-middle of the frame on dark slate, beside a folded black leather glove, a split block of cedar wood and a brushed-gold cufflink. Low, dramatic gold side light, masculine and tailored. The lower quarter of the frame fades into calm dark shadow.

Avoid: text, letters, logos, watermark, extra bottles, faces, clutter in the lower quarter.
```

#### cat-women
`assets/img/cat-women.jpg` · 4:5 · 1600 × 2000 · Reference: Aurelle

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 image: the exact same bottle as the reference image (clear faceted gemstone-cut bottle with blush-pink liquid and rose-gold ring, no label) stands in the upper-middle of the frame on flowing ivory silk, surrounded by scattered pale-pink rose petals and a delicate rose-gold bangle. Soft, glowing light refracts through the facets. Graceful and feminine. The lower quarter of the frame fades into calm dark shadow.

Avoid: text, letters, logos, watermark, extra bottles, faces, hot pink, clutter in the lower quarter.
```

#### cat-unisex-oud
`assets/img/cat-unisex-oud.jpg` · 4:5 · 1600 × 2000 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 image: the exact same bottle as the reference image (tall deep-amber glass bottle with faceted polished-gold cap, blank front) stands in the upper-middle of the frame on an antique brass tray, with dark oud wood chips smouldering in a small brass burner beside it. Tall, slow curls of incense smoke rise through a shaft of warm gold light. Timeless, ceremonial, shared by all. The lower quarter of the frame fades into calm dark shadow.

Avoid: text, letters, logos, watermark, extra bottles, flames, people, clutter in the lower quarter.
```

#### cat-gift
`assets/img/cat-gift.jpg` · 4:5 · 1600 × 2000 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 image: an open matte-black gift box lined with ivory satin, in the upper-middle of the frame, holding the exact same bottle as the reference image (tall deep-amber glass bottle with faceted polished-gold cap, blank front). A wide gold silk ribbon is loosened in soft loops around the box, with a few deep red rose petals nearby on black marble. Celebratory, generous, refined. The lower quarter of the frame fades into calm dark shadow.

Avoid: text, letters, logos, gift tags with writing, watermark, extra bottles, people, clutter in the lower quarter.
```

### 5.5 Lifestyle images (4:5, 1600 × 2000)

Use 4:5 so these sit next to the category cards and stack well on phones.

#### lifestyle-1: the vanity
`assets/img/lifestyle-1.jpg` · 4:5 · 1600 × 2000 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 lifestyle image: on a dark veined marble vanity, an elegant hand (hand and wrist only, no face, a thin gold ring) lifts the exact same bottle as the reference image (tall deep-amber glass bottle with faceted polished-gold cap, blank front) from an engraved brass tray. Beside the tray are a small brass bowl of rose petals and the blurred edge of a gilded mirror. Warm evening light, intimate and unhurried.

Avoid: text, letters, logos, watermark, faces, extra fingers, deformed hands, extra bottles, clutter.
```

#### lifestyle-2: the arch
`assets/img/lifestyle-2.jpg` · 4:5 · 1600 × 2000 · Reference: Velluto Nero

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 lifestyle image: the exact same bottle as the reference image (squat matte black glass bottle with brushed-gold collar, blank front) stands on a carved stone ledge, framed by the crisp shadow of a Mughal pointed arch cast by late golden light across a dark plaster wall. A length of ivory silk drapes down from the ledge in soft folds. Architectural, calm, quietly grand.

Avoid: text, letters, logos, watermark, people, extra bottles, bright daylight, clutter.
```

#### lifestyle-3: the ritual
`assets/img/lifestyle-3.jpg` · 4:5 · 1600 × 2000 · Reference: Aurelle

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 lifestyle close-up: one hand holds the exact same bottle as the reference image (clear faceted gemstone-cut bottle with blush-pink liquid and rose-gold ring, no label) and mists a fine, glittering spray onto the inner wrist of the other hand, which wears a delicate gold bangle and faint, elegant henna lines. Only hands and wrists are visible, no face. Below, rose petals rest on dark silk. Gold backlight catches the mist droplets.

Avoid: text, letters, logos, watermark, faces, extra fingers, deformed hands, extra bottles, heavy henna, clutter.
```

#### lifestyle-4: the courtyard
`assets/img/lifestyle-4.jpg` · 4:5 · 1600 × 2000 · Reference: Sahara Royale

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 lifestyle image: the exact same bottle as the reference image (softly rounded pale teal glass flask with brushed-silver cap, blank front) stands on a weathered red-sandstone ledge at dusk. A few strands of white jasmine (motia) lie beside it, and a carved jali lattice screen casts a soft geometric pattern of warm light and deep shadow across the stone. Fresh, peaceful, a hint of evening breeze.

Avoid: text, letters, logos, watermark, people, extra bottles, bright midday sun, saturated turquoise, clutter.
```

### 5.6 About images (3:2, 2400 × 1600)

#### about-1: the perfumer's hands
`assets/img/about-1.jpg` · 3:2 · 2400 × 1600 · No reference needed

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Horizontal 3:2 image: a perfumer's hands (hands and forearms only, no face, rolled sleeves of a dark linen shirt) carefully release a drop of golden oil from a glass pipette into a small beaker resting on an antique brass scale. Around them on a dark walnut workbench are rows of small unlabelled glass vials of amber and honey-coloured oils in a brass rack. Soft candlelight and a gold rim light. Craft, patience, precision.

Avoid: text, letters, labels with writing, logos, watermark, faces, extra fingers, deformed hands, lab-coat clinical look.
```

#### about-2: the ingredients
`assets/img/about-2.jpg` · 3:2 · 2400 × 1600 · No reference needed (Imagen 4 works well)

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Horizontal 3:2 overhead flat lay on dark slate: small brass bowls and loose arrangements of raw perfume ingredients, including dark resinous oud wood chips, deep red rose petals, threads of saffron, translucent amber resin, white jasmine blossoms, a split vanilla pod, a halved bergamot and a few cardamom pods. Generous dark space between groups, arranged with editorial precision. Raking gold light from one side gives every texture depth.

Avoid: text, letters, logos, watermark, bottles, hands, clutter, bright background.
```

#### about-3: the boutique
`assets/img/about-3.jpg` · 3:2 · 2400 × 1600 · Reference: optional, all four house references

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Horizontal 3:2 interior image: an intimate, softly lit luxury perfume boutique at night with no people. Dark lacquered shelves set into shallow Mughal-arch niches display rows of perfume bottles (amber glass with gold caps, matte black with gold collars, faceted pink glass, pale teal glass), each lit from below by a warm gold glow. A black marble counter with a brass tray sits in the soft-focus foreground. Hushed, exclusive, inviting.

Avoid: text, signage, letters, logos, price tags, watermark, people, faces, bright retail lighting, clutter.
```

### 5.7 Banners (21:9, 2560 × 1097)

Banners carry promotional text added by the site on the **left**. Put the subject in the **right third** and keep the left 60% as clean dark space. If the model can't make 21:9, generate at 16:9 with the subject **vertically centred**, then crop the centre band (1.6).

#### banner-1: the collection
`assets/img/banner-1.jpg` · 21:9 · 2560 × 1097 · Reference: all four house references

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Ultra-wide 21:9 banner: the four exact bottles from the reference images stand in a neat row on polished black marble in the right third of the frame, vertically centred. A low gold horizon glow spreads behind them like a dark sunset. The left 60% of the frame is clean, dark, empty negative space for headline text. Sleek, panoramic, calm.

Avoid: text, letters, logos, watermark, extra bottles, objects in the left 60%, clutter.
```

#### banner-2: oud smoke
`assets/img/banner-2.jpg` · 21:9 · 2560 × 1097 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Ultra-wide 21:9 banner: in the right third of the frame, vertically centred, the exact same bottle as the reference image (tall deep-amber glass bottle with faceted polished-gold cap, blank front) stands beside a small brass incense burner. Long, elegant ribbons of oud smoke curl slowly across the frame from right to left, thinning to nothing well before the left edge and lit gold where they cross the light. The left 60% stays dark and clean for headline text.

Avoid: text, letters, logos, watermark, extra bottles, dense fog, objects in the left 60%.
```

#### banner-3: the gifting season
`assets/img/banner-3.jpg` · 21:9 · 2560 × 1097 · No reference needed

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Ultra-wide 21:9 banner: in the right third of the frame, vertically centred, three matte-black gift boxes of different sizes are stacked and tied with wide gold silk ribbons, on black marble. Deep red rose petals and a loose curl of ivory satin ribbon are scattered around them, a few small warm candle-bokeh lights glowing behind. The left 60% stays dark and clean for headline text. Festive yet restrained.

Avoid: text, letters, logos, gift tags with writing, watermark, people, objects in the left 60%, clutter.
```

#### banner-4: summer freshness
`assets/img/banner-4.jpg` · 21:9 · 2560 × 1097 · Reference: Sahara Royale

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Ultra-wide 21:9 banner: in the right third of the frame, vertically centred, the exact same bottle as the reference image (softly rounded pale teal glass flask with brushed-silver cap, blank front) stands on rippled dark-gold sand, with thin translucent slices of orange and bergamot at its base and a cool teal glow passing through the glass. The left 60% fades into clean dark negative space for headline text. Fresh, cool, summery but still luxurious.

Avoid: text, letters, logos, watermark, extra bottles, bright daylight sky, saturated turquoise, objects in the left 60%.
```

### 5.8 Gift images (4:5, 1600 × 2000)

#### gift-1: the open box
`assets/img/gift-1.jpg` · 4:5 · 1600 × 2000 · Reference: Maison Noor

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 image, slightly high angle: an open matte-black gift box lined with ivory satin sits on an engraved brass tray. Nestled in the satin is the exact same bottle as the reference image (tall deep-amber glass bottle with faceted polished-gold cap, blank front). The box lid leans beside it, a wide gold silk ribbon lies loosened in soft loops, and a few deep red rose petals are scattered on dark marble. Warm, generous, the moment just before giving.

Avoid: text, letters, logos, gift cards or tags with writing, watermark, extra bottles, people, clutter.
```

#### gift-2: wrapping by hand
`assets/img/gift-2.jpg` · 4:5 · 1600 × 2000 · No reference needed

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Vertical 4:5 close-up: two elegant hands (hands and wrists only, no face, one thin gold ring) tie a wide gold silk ribbon into a bow around a closed matte-black gift box resting on an antique brass tray. Rose petals and a small sprig of white jasmine lie beside the box on dark marble. Soft candlelight from the side and a gold rim light on the ribbon's sheen. Careful, personal, handmade.

Avoid: text, letters, logos, gift tags with writing, watermark, faces, extra fingers, deformed hands, clutter.
```

### 5.9 Open Graph image (1.91:1, 1200 × 630)

This is the preview image shown when someone shares a link to the shop on WhatsApp, Facebook and similar apps. Keep everything important inside the central 80% of the frame, because apps crop the edges differently.

#### og
`assets/img/og.jpg` · 1.91:1 · 1200 × 630 (generate at 16:9, then crop) · Reference: all four house references

```
Premium editorial luxury fragrance photography. Dark, low-key setting dominated by near-black tones (#0B0B0C). Antique-gold (#C9A24B) rim light tracing edges and contours, soft ivory highlights on glass and metal, deep velvety shadows, shallow depth of field with creamy bokeh, tack-sharp focus on the hero subject, subtle fine film grain, restrained palette of black, antique gold, ivory and warm amber. Clean, unmarked surfaces and blank labels: pure product and scene only, unbranded and unsigned.

Wide 16:9 image designed to be cropped to 1.91:1: the four exact bottles from the reference images stand close together in a balanced group, centred in the frame and vertically centred, on polished black marble with fine gold veining. A soft gold glow behind them and a faint wisp of smoke. All important content stays within the central 80% of the frame, with even dark margins on every side. Iconic, instantly readable at small sizes.

Avoid: text, letters, logos, watermark, extra bottles, subjects near the edges, clutter.
```

---

## 6. Final checklist

**Before generating**
- [ ] The 4 house reference bottles exist in `media-refs/`, each with a blank front and the correct cap and colour.

**Before making the videos**
- [ ] The 4 video start frames exist in `media-refs/` (`start-hero-video.png`, `start-scent-video.png`, `start-about-video.png`, `start-gift-video.png`), all at 16:9 and each matching its video scene.

**Generated images (32): save as JPG in `assets/img/`**
- [ ] `assets/img/hero-1.jpg`
- [ ] `assets/img/hero-2.jpg`
- [ ] `assets/img/product-mn-01.jpg`
- [ ] `assets/img/product-mn-02.jpg`
- [ ] `assets/img/product-mn-03.jpg`
- [ ] `assets/img/product-vn-01.jpg`
- [ ] `assets/img/product-vn-02.jpg`
- [ ] `assets/img/product-vn-03.jpg`
- [ ] `assets/img/product-au-01.jpg`
- [ ] `assets/img/product-au-02.jpg`
- [ ] `assets/img/product-au-03.jpg`
- [ ] `assets/img/product-sr-01.jpg`
- [ ] `assets/img/product-sr-02.jpg`
- [ ] `assets/img/product-sr-03.jpg`
- [ ] `assets/img/cat-men.jpg`
- [ ] `assets/img/cat-women.jpg`
- [ ] `assets/img/cat-unisex-oud.jpg`
- [ ] `assets/img/cat-gift.jpg`
- [ ] `assets/img/lifestyle-1.jpg`
- [ ] `assets/img/lifestyle-2.jpg`
- [ ] `assets/img/lifestyle-3.jpg`
- [ ] `assets/img/lifestyle-4.jpg`
- [ ] `assets/img/about-1.jpg`
- [ ] `assets/img/about-2.jpg`
- [ ] `assets/img/about-3.jpg`
- [ ] `assets/img/banner-1.jpg`
- [ ] `assets/img/banner-2.jpg`
- [ ] `assets/img/banner-3.jpg`
- [ ] `assets/img/banner-4.jpg`
- [ ] `assets/img/gift-1.jpg`
- [ ] `assets/img/gift-2.jpg`
- [ ] `assets/img/og.jpg`

**Videos (4): save as MP4 in `assets/video/`, compressed, with audio removed**
- [ ] `assets/video/hero-video.mp4`
- [ ] `assets/video/scent-video.mp4`
- [ ] `assets/video/about-video.mp4`
- [ ] `assets/video/gift-video.mp4`

**Posters (4): first frame exported from each video, not generated**
- [ ] `assets/img/poster-hero-video.jpg`
- [ ] `assets/img/poster-scent-video.jpg`
- [ ] `assets/img/poster-about-video.jpg`
- [ ] `assets/img/poster-gift-video.jpg`

**Quality pass (check every file)**
- [ ] No readable text, letters, logos or watermarks anywhere. Zoom in on the bottles and boxes.
- [ ] Each house's bottle looks identical in every image it appears in (shape, cap, colour).
- [ ] No faces or identifiable people. Hands look natural, with five fingers.
- [ ] The background is near-black with gold rim light, and the set looks consistent across the shop grid.
- [ ] Hero and banner images keep the headline space empty (left side).
- [ ] Filenames are exact (lowercase, hyphens, `.jpg` or `.mp4`) and files are in the right folder.
- [ ] Image sizes match the table in section 3, and file sizes are reasonable (images under about 700 KB, videos under about 6 MB).
- [ ] Each video loops without a visible jump: its first and last frames match, and the camera returns to its starting position. If one still jumps after a regeneration, use the "boomerang" command in 1.6 as a fallback.
- [ ] No stray glyphs, fake signage or watermarks. If you see any, follow 1.7: move the "Avoid:" line into the negative field and regenerate.
- [ ] Open the site locally and check that each placeholder has been replaced by the right image.

---

## Delivery notes (Tasks 17 and 17c, October 2026)

What was actually delivered differs from the plan above in a few places. The site follows the delivered files.

**Shapes as delivered (the manifest `aspect` now matches the files, so each box is reserved at the right shape)**
- Banners: 16:9 (2000 × 1116), not 21:9. Pages crop them with `object-fit: cover`; on phones and portrait tablets the banner becomes a band above the copy, anchored to the right where the bottles are.
- Categories, lifestyle and gift: 3:4 (1493 × 2000), not 4:5. The tiles keep their own shapes and crop with `cover`.
- About: 4:3 (2000 × 1493), not 3:2. The about frames stay 3:2 and crop slightly.
- Hero (16:9), products (1:1) and the four posters (1280 × 720) match the plan.

**Installed (Task 17c: the set is complete):** every slot in the manifest has its file. hero-1 and hero-2; the twelve product photos (mn-01 to sr-03); banner-1 to banner-4; cat-men, cat-women, cat-unisex-oud, cat-gift; lifestyle-1 to lifestyle-4; about-1 to about-3; gift-1, gift-2; the four posters; the four videos; and the real social card `og.jpg`. Nothing is missing any more: `KNOWN_MISSING` in `tests/e2e/helpers.js` is empty, and the media tests require every manifest file to exist, be a real JPEG/MP4 of the manifest shape and fit the size budget.

**`assets/img/og.jpg`** is cut from `og-source.jpg` (2000 x 1116: the four house bottles, amber, black, pink and teal, on a black marble slab, copy space on the left). Scaled to 1200 px wide it is 1200 x 670, so covering 1200 x 630 only trims 40 px of height; the full width, with all four bottles in the right half, stays in the frame. The 40 px come mostly off the empty top (offset 40 %), keeping the slab and its reflection:

```bash
ffmpeg -i og-source.jpg -vf "scale=1200:-2:flags=lanczos,crop=1200:630:0:(ih-630)*0.4" -q:v 4 -map_metadata -1 og.jpg
```

If a future source is wider than 1.905:1 the crop becomes horizontal: keep the bottles in frame with an x offset instead of a centre crop, e.g. `crop=1200:630:(iw-1200)*0.85:0` for bottles on the right.

**Where each file is used** (checked by `tests/e2e/media-usage.spec.js`, which fails with the list of any slot no page shows):
- hero-1 + hero-video (+ poster): home hero. hero-2: the 404 page ("This page has evaporated", over the curling smoke).
- banner-1: brands opening. banner-2 and banner-4: the fragrance guide's "two ends of the shelf" pair (oud and fresh). banner-3: the home gift banner.
- gift-video (+ poster), gift-1, gift-2: the "Gift wrapping" section of shipping & returns (linked from the home gift banner).
- about-video (+ poster): the atelier band on about. scent-video (+ poster): the scent quiz intro.
- products: shop, product pages, cards, bag, checkout, wishlist, order tracking. Categories and lifestyle: home and brands. about-1 to about-3: about. og: every page's og:image.

**Clips other than the home hero** load with `preload="metadata"` and no `autoplay`: they start only when on screen (IntersectionObserver in `ui.js`), the most visible one plays and the rest pause, and with reduced motion none of them ever plays (the poster shows).

**How the files were optimised (every image and clip; ffmpeg 9)**

```bash
# Product (1:1), category, lifestyle, gift, about: long edge 1600 px, JPEG quality about 82, metadata stripped
ffmpeg -i in.jpg -vf "scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))':flags=lanczos" -q:v 4 -map_metadata -1 out.jpg

# Hero and banners (16:9): long edge 2000 px
ffmpeg -i in.jpg -vf "scale='min(2000,iw)':-2:flags=lanczos" -q:v 4 -map_metadata -1 out.jpg

# Social card (1200 x 630) from og-source.jpg (2000 x 1116): scale to 1200 wide, trim 40 px of height (mostly the empty top)
ffmpeg -i og-source.jpg -vf "scale=1200:-2:flags=lanczos,crop=1200:630:0:(ih-630)*0.4" -q:v 4 -map_metadata -1 og.jpg

# Videos: H.264, no audio, fast start, about 0.5-1.3 MB for 8 s at 1280 x 720
ffmpeg -i in.mp4 -an -c:v libx264 -preset slow -crf 26 -profile:v high -pix_fmt yuv420p -movflags +faststart -map_metadata -1 out.mp4
```

Keep a file's original if the optimised one comes out larger. ffmpeg writes baseline (not progressive) JPEGs; at these sizes (60 to 200 KB) that makes no visible difference. Every image must stay under 600 KB and every video under 3 MB (the tests check this).

**about-video: label artefact masked (Task 17d, October 2026)**

The owner's `about-video.mp4` shows an AI-generated etched label ("Cc9A24B") on the glass tube lying on the brass dish. It is visible for the whole 8 s: it starts at about (826, 483) in the 1280 x 720 frame and drifts right and down with the slow camera move to about (965, 530) at 7 s, so no clean stretch of 4 s or more exists to trim to. The other take (`Perfumer_atelier_with_candle_smoke_20261013234942.mp4`) is worse: every vial carries a garbled label ("OB0B", "A9A24", and so on) throughout, so it was not used.

The clip is therefore kept at full length (same loop behaviour as before) and the label is blurred away with a feathered, moving ellipse: a heavily blurred copy of the frame is laid over the original, with an alpha mask that follows the label (centre `826 + 19.9 t, 483 + 6.8 t`, radii `100 + 4 t` by `30 + 2 t`, full strength in the inner 37 %, fading out to the edge). Frames at 0.5 s steps were checked: the tube reads as clean glass, no text left. The poster is the new first frame.

```bash
# from the original (kept outside the repo as about-video.orig.mp4)
ffmpeg -y -i about-video.orig.mp4 -filter_complex "[0:v]split[a][b];[b]gblur=sigma=10,eq=brightness=-0.06,format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*clip(1.6*(1-hypot((X-(826+19.9*T))/(100+4*T),(Y-(483+6.8*T))/(30+2*T))),0,1)'[m];[a][m]overlay=format=auto,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart assets/video/about-video.mp4
ffmpeg -y -ss 0 -i assets/video/about-video.mp4 -frames:v 1 -q:v 3 assets/img/poster-about-video.jpg
```

Result: 1280 x 720, 8 s, h264, no audio, 0.83 MB (the original was 0.79 MB). If a future take has a different label position, find it with `ffmpeg -i in.mp4 -vf "fps=1,crop=640:320:640:400,drawgrid=w=80:h=80:t=1:c=cyan@0.5,tile=2x4" -frames:v 1 grid.png` and adjust the centre and radius expressions.
