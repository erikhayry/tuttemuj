# Images

The app shows the site's images (the site owner has agreed), loaded from nykarlebyvyer.nu and linked to their page. To pick which ones to show, `images:classify` asks [TypeSafe Jev](https://docs.typesafe.ai/images) what each image shows and saves only the answers in `data/images.jsonl`.

## How it runs

- Part of the nightly job, after the crawl (`scripts/nightly.sh`), so the site gets one request at a time. Up to `IMAGE_CLASSIFY_LIMIT` images per night (default 1000), `CRAWL_DELAY_MS` apart, with the crawler's User-Agent. About 15,300 images in total, so roughly 16 nights.
- Each image is written to a temporary folder, converted with macOS `sips` to a JPEG within TypeSafe's limits (each side 280–1568 px; too-thin panoramas are padded with white), sent, and deleted. The image is never stored.
- Logos and headers (`isDecorativeImage`, by file name) are never fetched.
- Needs `JEV_API_KEY` in `.env`. Without it the step does nothing. An API error stops the run and is never saved as an answer.
- Cost: about 1,000–1,900 input tokens per image at $0.042 per million, so well under $1 for the whole site.
- By hand: `IMAGE_CLASSIFY_LIMIT=5 pnpm --filter @tuttemuj/crawler images:classify`.

## The questions

Four yes/no questions (Nouls), worded in `apps/crawler/src/images/questions.ts`. Each is a separate probability, so a street photo can be "building visible" and "people visible" at once:

| Field             | Question                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| `photo`           | Is it a photograph (not a drawing, map, logo, heading or scanned page)? |
| `buildingVisible` | Is a building visible anywhere, even small or in the background?        |
| `peopleVisible`   | Are people visible anywhere, even small or in the background?           |
| `peopleSubject`   | Are the people what the photo is about (a portrait or group photo)?     |

Code decides, not Jev (`packages/schema/src/image-class.ts`):

- **Shown** (`isShowableImage`): `photo` > 0.7 and `buildingVisible` or `peopleVisible` > 0.7.
- **To review** (`needsImageReview`): `photo` between 0.3 and 0.7. Hidden until a person has looked.
- `peopleSubject` is kept for a later "photos of people" filter.

## How it was tested

On 2026-11-24, on hand-labelled images from the site:

1. 30 random images. Asking "is X the main subject" missed most buildings and people that were labelled, because the labels meant "visible". Changing the definition to "visible anywhere, even small" fixed it: no labelled building or person was missed.
2. 30 new random images, with the wording unchanged (not tuned on them):

| Question               | Agrees with the label | Unsure (0.3–0.7) |
| ---------------------- | --------------------- | ---------------- |
| Not a photo            | 29 / 30               | 1                |
| People visible         | 25 / 30               | 4                |
| People are the subject | 24 / 30               | 5                |
| Building visible       | 23 / 30               | 2                |
| **Shown or not**       | **30 / 30**           |                  |

"Building visible" sometimes says yes where the label said no (small or partly hidden buildings), which is harmless for showing. "Building is the subject" was dropped: it disagreed with the labels on 7 of 30.

Known weak spot: a photograph of a printed page or a picture counts as a photo.

## Versions

Bump `IMAGE_QUESTIONS_VERSION` when the questions, their wording or the model (`JEV_MODEL`, pinned to `jev-1.14.0`) change; every image is then asked again.

- **1**: the four questions above, `jev-1.14.0`.
