export interface MediaItem {
  url: string;
  type: "image" | "video";
}

export interface PublishPostData {
  content: string;
  mediaUrls?: string[];
  videoUrl?: string;
  comment?: string; // Optional comment to post after the main post
  progressCallback?: (step: string) => void; // Optional callback to track progress
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export abstract class BasePlatformAdapter {
  abstract publishPost(data: PublishPostData): Promise<PublishResult>;
  abstract validateMedia(url: string): Promise<boolean>;
  abstract getName(): string;
}
