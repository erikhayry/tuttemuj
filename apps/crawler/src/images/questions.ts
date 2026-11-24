/**
 * Every question Jev is asked about an image, in one place, so the wording can be read and changed
 * together. Changing the wording means bumping IMAGE_QUESTIONS_VERSION and noting it in
 * docs/images.md. The wording was tested on 60 hand-labelled images (docs/images.md).
 *
 * Each is a Noul (a yes/no probability), so several can be true at once: a street photo can show a
 * building and people. A Choice would have to split its probability between them.
 */
export const IMAGE_QUESTIONS = {
  photo: {
    type: "noul",
    instructions: "Is `image` a photograph?",
    criteria: {
      true: "A photograph of real places or people, including old black-and-white photos and photographic postcards.",
      false: "A drawing, painting, map, scanned document, logo or text heading.",
    },
  },
  buildingVisible: {
    type: "noul",
    instructions:
      "A building, or part of one, is visible anywhere in `image`, even small or in the background.",
  },
  peopleVisible: {
    type: "noul",
    instructions:
      "One or more people are visible anywhere in `image`, even small or in the background.",
  },
  peopleSubject: {
    type: "noul",
    instructions:
      "`image` is a photo of people: the people are what the photo is about, such as a portrait or group photo.",
  },
} as const;

export type ImageQuestion = keyof typeof IMAGE_QUESTIONS;
