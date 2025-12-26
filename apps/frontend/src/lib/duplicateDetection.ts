/**
 * Utility functions for detecting duplicate posts
 * based on description, topic, and image URLs
 */

export interface DuplicateCheckData {
  description?: string;
  topic?: string;
  imageUrls?: string[];
}

export interface DuplicatePost {
  _id: string;
  content: string;
  comment?: string;
  topic?: string;
  imageUrls: string[];
}

/**
 * Normalize string for comparison: lowercase, trim, sort urls
 */
export function normalizeForComparison(
  description?: string,
  topic?: string,
  imageUrls?: string[]
): {
  description: string;
  topic: string;
  imageUrlsHash: string;
} {
  return {
    description: (description || "").toLowerCase().trim(),
    topic: (topic || "").toLowerCase().trim(),
    imageUrlsHash: (imageUrls || [])
      .map((url) => url.toLowerCase().trim())
      .sort()
      .join("|"),
  };
}

/**
 * Check if two posts are duplicates
 */
export function isDuplicate(
  post1: DuplicateCheckData,
  post2: DuplicatePost | DuplicateCheckData
): boolean {
  const norm1 = normalizeForComparison(
    post1.description,
    post1.topic,
    post1.imageUrls
  );

  // Handle both DuplicatePost and DuplicateCheckData
  let post2Desc = "";
  if ("comment" in post2) {
    post2Desc = post2.comment || "";
  } else if ("description" in post2) {
    post2Desc = post2.description || "";
  }

  const norm2 = normalizeForComparison(post2Desc, post2.topic, post2.imageUrls);

  // All three must match: description, topic, and image URLs
  return (
    norm1.description === norm2.description &&
    norm1.topic === norm2.topic &&
    norm1.imageUrlsHash === norm2.imageUrlsHash
  );
}

/**
 * Find duplicate posts from a list of existing posts
 */
export function findDuplicates(
  newPost: DuplicateCheckData,
  existingPosts: DuplicatePost[]
): DuplicatePost[] {
  return existingPosts.filter((existingPost) =>
    isDuplicate(newPost, existingPost)
  );
}

/**
 * Find duplicates in a batch of posts
 */
export function findBatchDuplicates(
  newPosts: DuplicateCheckData[],
  existingPosts: DuplicatePost[]
): {
  duplicates: Array<{
    index: number; // Index in the new posts array
    post: DuplicateCheckData;
    matches: DuplicatePost[];
  }>;
  unique: Array<{
    index: number;
    post: DuplicateCheckData;
  }>;
} {
  const duplicates: Array<{
    index: number;
    post: DuplicateCheckData;
    matches: DuplicatePost[];
  }> = [];
  const unique: Array<{ index: number; post: DuplicateCheckData }> = [];

  newPosts.forEach((post, index) => {
    const matches = findDuplicates(post, existingPosts);
    if (matches.length > 0) {
      duplicates.push({ index, post, matches });
    } else {
      unique.push({ index, post });
    }
  });

  return { duplicates, unique };
}
