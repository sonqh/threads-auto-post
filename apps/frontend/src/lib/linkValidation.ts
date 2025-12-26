/**
 * Link validation utilities
 * Extracted for reuse across components
 */

export const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateLink = (
  url: string
): { valid: boolean; error?: string } => {
  if (!url.trim()) {
    return { valid: false, error: "URL is required" };
  }

  if (!isValidUrl(url)) {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check if URL is accessible (optional, can be enhanced with actual ping)
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { valid: false, error: "URL must start with http:// or https://" };
  }

  return { valid: true };
};

export const filterValidLinks = (links: string[]): string[] => {
  return links.filter((link) => isValidUrl(link));
};

export const validateLinks = (
  links: string[]
): { valid: boolean; errors: Record<number, string> } => {
  const errors: Record<number, string> = {};

  links.forEach((link, index) => {
    if (link.trim()) {
      const validation = validateLink(link);
      if (!validation.valid && validation.error) {
        errors[index] = validation.error;
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0 && links.some((l) => isValidUrl(l)),
    errors,
  };
};
