import dotenvConfig from "./dotenv.config.js";

dotenvConfig.config();
/**
 * Environment Configuration Loader
 * Loads and validates all environment variables with proper type safety
 */

interface AppConfig {
  server: {
    port: number;
    nodeEnv: "development" | "production" | "test";
    corsOrigin: string;
  };
  database: {
    mongodbUri: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  threads: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    apiVersion: string;
    // Legacy support: default account credentials (optional)
    defaultUserId?: string;
    defaultAccessToken?: string;
    defaultRefreshToken?: string;
  };
  file: {
    maxSize: number;
    uploadDir: string;
  };
  queue: {
    workerConcurrency: number;
    jobTimeout: number;
  };
  scheduler: {
    useEventDriven: boolean;
    batchWindowMs: number;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
  };
}

/**
 * Load and validate environment variables
 */
export const loadConfig = (): AppConfig => {
  const config: AppConfig = {
    server: {
      port: parseInt(process.env.PORT || "3001", 10),
      nodeEnv: (process.env.NODE_ENV || "development") as
        | "development"
        | "production"
        | "test",
      corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
    },
    database: {
      mongodbUri:
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/threads-post-scheduler",
    },
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
    },
    threads: {
      clientId: process.env.THREADS_CLIENT_ID || "",
      clientSecret: process.env.THREADS_CLIENT_SECRET || "",
      redirectUri:
        process.env.THREADS_REDIRECT_URI ||
        "http://localhost:3001/api/credentials/callback",
      apiVersion: process.env.THREADS_API_VERSION || "v1.0",
      // Legacy: optional default account for backward compatibility
      defaultUserId: process.env.THREADS_USER_ID,
      defaultAccessToken: process.env.THREADS_ACCESS_TOKEN,
      defaultRefreshToken: process.env.THREADS_REFRESH_TOKEN,
    },
    file: {
      maxSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10),
      uploadDir: process.env.UPLOAD_DIR || "./uploads",
    },
    queue: {
      workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
      jobTimeout: parseInt(process.env.JOB_TIMEOUT || "30000", 10),
    },
    scheduler: {
      useEventDriven: process.env.USE_EVENT_DRIVEN_SCHEDULER === "true",
      batchWindowMs: parseInt(
        process.env.SCHEDULER_BATCH_WINDOW_MS || "60000",
        10
      ),
    },
    logging: {
      level: (process.env.LOG_LEVEL || "info") as
        | "debug"
        | "info"
        | "warn"
        | "error",
    },
  };

  // Validate critical config
  validateConfig(config);

  return config;
};

/**
 * Validate configuration
 */
function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // Validate server port
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push("Invalid PORT: must be between 1 and 65535");
  }

  // Validate MongoDB URI
  if (!config.database.mongodbUri) {
    errors.push("MONGODB_URI is required");
  }

  // Validate Redis port
  if (config.redis.port < 1 || config.redis.port > 65535) {
    errors.push("Invalid REDIS_PORT: must be between 1 and 65535");
  }

  // Warn if Threads OAuth credentials are not set
  if (!config.threads.clientId || !config.threads.clientSecret) {
    console.warn(
      "⚠️  THREADS_CLIENT_ID and THREADS_CLIENT_SECRET are not configured. " +
        "OAuth flow will not work. Users will need to manually enter credentials " +
        "or use legacy mode with THREADS_ACCESS_TOKEN."
    );
  }

  // Info: multi-account setup
  if (config.threads.defaultUserId && config.threads.defaultAccessToken) {
    console.info(
      "✅ Legacy account credentials detected. This account will be " +
        "available as the default account on startup."
    );
  } else {
    console.info(
      "ℹ️  Multi-account mode: Credentials are managed via the Settings UI. " +
        "Users can link multiple Threads accounts through the application."
    );
  }

  if (errors.length > 0) {
    console.error("Configuration validation errors:");
    errors.forEach((error) => console.error(`  - ${error}`));
    throw new Error("Invalid configuration");
  }
}

// Export singleton instance
export const appConfig = loadConfig();
