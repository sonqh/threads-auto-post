#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from '../src/config/database.js';
import {
    Post,
    PostType,
    PostStatus,
    CommentStatus,
    generateContentHash,
} from '../src/models/Post.js';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const EXPORT_DIR = path.join(__dirname, 'instagram-museinrose102-2026-01-04-JzumtgsY');
const THREADS_JSON = path.join(EXPORT_DIR, 'your_instagram_activity/threads/threads_and_replies.json');
const MEDIA_BASE = path.join(EXPORT_DIR, 'media');

// Statistics tracking
const stats = {
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    mediaResolved: 0,
    mediaFailed: 0,
    startTime: null,
    endTime: null,
};

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Resolve media file path from URI
 * Searches multiple locations for media files
 */
function resolveMediaPath(relativeUri, baseDir) {
    if (!relativeUri || relativeUri.trim() === '') {
        return null;
    }

    // Extract just the filename
    const filename = path.basename(relativeUri);

    // Try multiple location patterns
    const searchLocations = [
        path.join(baseDir, relativeUri), // Exact URI path
        path.join(baseDir, filename), // Top-level media
        path.join(baseDir, 'posts/202511', filename), // Nov 2025
        path.join(baseDir, 'posts/202512', filename), // Dec 2025
        path.join(baseDir, 'posts/202510', filename), // Oct 2025
        path.join(baseDir, 'profile/202510', filename), // Profile
        path.join(baseDir, 'reels/202510', filename), // Reels
    ];

    // Search for file
    for (const location of searchLocations) {
        if (fs.existsSync(location)) {
            return location;
        }
    }

    return null;
}

/**
 * Determine post type based on media files
 */
function determinePostType(mediaItems) {
    const validMedia = mediaItems.filter((m) => m.uri && m.uri.trim() !== '');

    if (validMedia.length === 0) {
        return PostType.TEXT;
    }

    // Check for video files
    const hasVideo = validMedia.some((m) =>
        /\.(mp4|mov|avi|mkv)$/i.test(m.uri)
    );

    if (hasVideo) {
        return PostType.VIDEO;
    }

    if (validMedia.length > 1) {
        return PostType.CAROUSEL;
    }

    return PostType.IMAGE;
}

/**
 * Extract post ID from media URI
 * Example: "media/18069745118572866.webp" → "18069745118572866"
 */
function extractPostId(uri) {
    if (!uri) return null;
    const match = uri.match(/\/(\d+)\.\w+$/);
    return match ? match[1] : null;
}

/**
 * Categorize media items into images and videos
 */
function categorizeMedia(mediaItems, baseDir) {
    const images = [];
    const videos = [];
    let failedCount = 0;

    mediaItems.forEach((item) => {
        if (!item.uri || item.uri.trim() === '') {
            return;
        }

        const resolvedPath = resolveMediaPath(item.uri, baseDir);

        if (!resolvedPath) {
            failedCount++;
            log(
                `⚠️  Media not found: ${item.uri}`,
                'yellow'
            );
            return;
        }

        stats.mediaResolved++;

        // Determine media type
        if (/\.(mp4|mov|avi|mkv)$/i.test(item.uri)) {
            videos.push(resolvedPath);
        } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(item.uri)) {
            images.push(resolvedPath);
        }
    });

    stats.mediaFailed += failedCount;
    return { images, videos };
}

/**
 * Build a Post document from raw thread data
 */
async function buildPostDocument(threadData, baseDir) {
    const {
        title,
        creation_timestamp,
        media = [],
    } = threadData;

    // Skip empty posts
    const hasContent = title && title.trim().length > 0;
    const hasMedia = media.filter((m) => m.uri && m.uri.trim()).length > 0;

    if (!hasContent && !hasMedia) {
        return null;
    }

    // Resolve media files
    const { images, videos } = categorizeMedia(media, baseDir);

    // Determine post type
    const postType = determinePostType(media);

    // Extract post ID from first media item
    let threadsPostId = null;
    if (media.length > 0 && media[0].uri) {
        threadsPostId = extractPostId(media[0].uri);
    }

    // Generate content hash for duplicate detection
    const contentHash = generateContentHash(title || '', images, videos[0]);

    // Convert Unix timestamp (seconds) to milliseconds
    const publishedAt = new Date(creation_timestamp * 1000);

    // Create Post document
    const post = new Post({
        content: title || '[Media-only post]',
        status: PostStatus.PUBLISHED,
        postType,
        imageUrls: images,
        videoUrl: videos.length > 0 ? videos[0] : undefined,
        publishedAt,
        threadsPostId,
        contentHash,
        commentStatus: CommentStatus.NONE,
        // Optional fields for tracking
        topic: 'Imported from Threads Export',
    });

    return post;
}

/**
 * Check if post already exists and handle duplicates
 */
async function checkAndImportPost(post) {
    if (!post) {
        return { skipped: true, reason: 'empty' };
    }

    try {
        // Check if post with same threadsPostId and timestamp already exists
        if (post.threadsPostId) {
            const existing = await Post.findOne({
                threadsPostId: post.threadsPostId,
            });

            if (existing) {
                return { skipped: true, reason: 'duplicate-id' };
            }
        }

        // Check for content duplicates within ±1 hour
        if (post.contentHash) {
            const oneHour = 3600000;
            const contentDupe = await Post.findOne({
                contentHash: post.contentHash,
                publishedAt: {
                    $gte: new Date(post.publishedAt.getTime() - oneHour),
                    $lte: new Date(post.publishedAt.getTime() + oneHour),
                },
            });

            if (contentDupe) {
                return { skipped: true, reason: 'duplicate-content' };
            }
        }

        // Save the post
        const saved = await post.save();
        return { success: true, id: saved._id };
    } catch (error) {
        throw new Error(`Import failed: ${error.message}`);
    }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format elapsed time
 */
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

/**
 * Main import function
 */
async function main() {
    try {
        stats.startTime = Date.now();

        // Validate paths
        log('\n🔍 Validating paths...', 'cyan');
        if (!fs.existsSync(THREADS_JSON)) {
            throw new Error(`threads_and_replies.json not found at ${THREADS_JSON}`);
        }
        log('✅ threads_and_replies.json found', 'green');

        if (!fs.existsSync(MEDIA_BASE)) {
            log('⚠️  Media folder not found - continuing with text-only posts', 'yellow');
        } else {
            log('✅ Media folder found', 'green');
        }

        // Connect to database
        log('\n🔌 Connecting to MongoDB...', 'cyan');
        await connectDatabase();
        log('✅ Connected to MongoDB', 'green');

        // Read threads data
        log('\n📖 Reading threads data...', 'cyan');
        const jsonContent = fs.readFileSync(THREADS_JSON, 'utf8');
        const data = JSON.parse(jsonContent);
        const posts = data.text_post_app_text_posts || [];

        stats.total = posts.length;
        log(`✅ Found ${stats.total} posts to import`, 'green');

        // Import posts
        log('\n🚀 Starting import process...', 'cyan');
        log(`Processing ${stats.total} posts\n`, 'bright');

        for (let index = 0; index < posts.length; index++) {
            const progress = ((index + 1) / stats.total * 100).toFixed(1);
            process.stdout.write(
                `\r[${index + 1}/${stats.total}] ${progress}% - Imported: ${stats.imported}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`
            );

            try {
                const threadData = posts[index];

                // Build post document
                const post = await buildPostDocument(threadData, MEDIA_BASE);

                if (!post) {
                    stats.skipped++;
                    continue;
                }

                // Check and import
                const result = await checkAndImportPost(post);

                if (result.success) {
                    stats.imported++;
                } else if (result.skipped) {
                    stats.skipped++;
                }
            } catch (error) {
                stats.failed++;
                // Log detailed error for first few failures
                if (stats.failed <= 5) {
                    log(`\n❌ Error at post ${index + 1}: ${error.message}`, 'red');
                }
            }
        }

        // Print summary
        stats.endTime = Date.now();
        const elapsedMs = stats.endTime - stats.startTime;
        const elapsedTime = formatTime(elapsedMs);

        log('\n\n' + '='.repeat(70), 'bright');
        log('📊 IMPORT SUMMARY', 'bright');
        log('='.repeat(70), 'bright');
        log(`Total Posts:     ${stats.total}`, 'cyan');
        log(`✅ Imported:      ${stats.imported} (${(stats.imported / stats.total * 100).toFixed(1)}%)`, 'green');
        log(`⏭️  Skipped:       ${stats.skipped} (${(stats.skipped / stats.total * 100).toFixed(1)}%)`, 'yellow');
        log(`❌ Failed:        ${stats.failed} (${(stats.failed / stats.total * 100).toFixed(1)}%)`, 'red');
        log('', 'reset');
        log(`Media Resolved:  ${stats.mediaResolved}`, 'blue');
        log(`Media Failed:    ${stats.mediaFailed}`, 'red');
        log('', 'reset');
        log(`⏱️  Elapsed Time:  ${elapsedTime}`, 'cyan');
        log(`⚡ Speed:         ${Math.round(stats.total / (elapsedMs / 1000))} posts/sec`, 'magenta');
        log('='.repeat(70), 'bright');

        // Success exit
        process.exit(stats.failed === 0 ? 0 : 1);
    } catch (error) {
        log('\n\n❌ FATAL ERROR', 'red');
        log(error.message, 'red');
        log('\nStack trace:', 'dim');
        console.error(error);
        process.exit(1);
    }
}

// Run the script
main();
