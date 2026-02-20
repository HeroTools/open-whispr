const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { app } = require("electron");
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const debugLogger = require("./debugLogger");

/**
 * Generic S3-compatible cloud storage manager for recording backups.
 *
 * Works with any S3-compatible provider:
 *   - Cloudflare R2:  https://<accountId>.r2.cloudflarestorage.com
 *   - AWS S3:         https://s3.<region>.amazonaws.com
 *   - Backblaze B2:   https://s3.<region>.backblazeb2.com
 *   - MinIO:          http://localhost:9000
 *   - etc.
 *
 * Credentials are persisted in %APPDATA%/OpenWhispr/s3-config.json.
 */
class S3StorageManager {
  constructor() {
    this._client = null;
    this._config = null;
  }

  // ── Config persistence ────────────────────────────────────────────────

  _configPath() {
    return path.join(app.getPath("userData"), "s3-config.json");
  }

  getConfig() {
    if (this._config) return this._config;
    try {
      if (fs.existsSync(this._configPath())) {
        this._config = JSON.parse(fs.readFileSync(this._configPath(), "utf-8"));
        return this._config;
      }
    } catch {
      // ignore corrupt config
    }
    return {};
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this._configPath(), JSON.stringify(config, null, 2));
      this._config = config;
      this._client = null; // bust cached client
      return true;
    } catch (error) {
      debugLogger.error("Failed to save S3 config", { error: error.message });
      return false;
    }
  }

  /**
   * Returns true when all required fields are present.
   */
  isConfigured() {
    const c = this.getConfig();
    return !!(c.endpointUrl && c.accessKeyId && c.secretAccessKey && c.bucket);
  }

  /**
   * Returns true when cloud upload is enabled AND configured.
   */
  isEnabled() {
    const c = this.getConfig();
    return c.enabled !== false && this.isConfigured();
  }

  // ── S3 Client ─────────────────────────────────────────────────────────

  _getClient() {
    if (this._client) return this._client;
    const c = this.getConfig();
    if (!c.endpointUrl || !c.accessKeyId || !c.secretAccessKey) {
      throw new Error("S3 credentials not configured");
    }
    this._client = new S3Client({
      region: c.region || "auto",
      endpoint: c.endpointUrl,
      credentials: {
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey,
      },
      forcePathStyle: c.forcePathStyle !== false, // default true for most S3-compatible providers
    });
    return this._client;
  }

  _getBucket() {
    const c = this.getConfig();
    if (!c.bucket) throw new Error("S3 bucket not configured");
    return c.bucket;
  }

  // ── Operations ────────────────────────────────────────────────────────

  /**
   * Full connection test: HeadBucket → write test object → read via presigned URL → delete.
   * This confirms the bucket exists, credentials have write access, and presigned URLs
   * are publicly readable (required for passing URLs to transcription providers).
   *
   * @returns {Promise<{success: boolean, error?: string, details?: object}>}
   */
  async testConnection() {
    const testKey = `_openwhispr_test_${Date.now()}.txt`;
    const testBody = "OpenWhispr S3 connectivity test";
    const details = { steps: [] };

    try {
      const client = this._getClient();
      const bucket = this._getBucket();

      // Step 1: HeadBucket — verify bucket access
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      details.steps.push("bucket_access");

      // Step 2: PutObject — verify write permission
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: testKey,
          Body: Buffer.from(testBody),
          ContentType: "text/plain",
        })
      );
      details.steps.push("write");

      // Step 3: Generate presigned URL and fetch it — verify public read
      const presignedUrl = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: testKey }),
        { expiresIn: 60 }
      );
      details.steps.push("presign");

      const readResult = await this._httpGet(presignedUrl);
      if (readResult !== testBody) {
        throw new Error(
          `Presigned URL returned unexpected content (got ${readResult.length} bytes). ` +
          "Check that presigned URLs are not blocked by bucket policy or CORS."
        );
      }
      details.steps.push("public_read");

      // Step 4: Cleanup
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
      details.steps.push("delete");

      return { success: true, details };
    } catch (error) {
      // Best-effort cleanup
      try {
        const client = this._getClient();
        const bucket = this._getBucket();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
      } catch { /* ignore */ }

      debugLogger.error("S3 connection test failed", { error: error.message, details });
      return { success: false, error: error.message, details };
    }
  }

  /**
   * Simple HTTP GET that returns the response body as a string.
   * Used to verify presigned URL readability.
   */
  _httpGet(url, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith("https") ? https : http;
      const req = mod.get(url, { timeout: timeoutMs }, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} from presigned URL`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Presigned URL request timed out"));
      });
    });
  }

  /**
   * Upload a local file to S3.
   *
   * @param {string} filePath - Absolute path to the file on disk
   * @param {object} [options]
   * @param {string} [options.key]         - Object key (defaults to filename)
   * @param {string} [options.contentType] - MIME type (defaults to audio/wav)
   * @returns {Promise<{success: boolean, key?: string, error?: string}>}
   */
  async uploadFile(filePath, options = {}) {
    try {
      const client = this._getClient();
      const bucket = this._getBucket();
      const key = options.key || path.basename(filePath);
      const contentType = options.contentType || "audio/wav";

      const body = fs.readFileSync(filePath);

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );

      debugLogger.debug("S3 upload complete", {
        key,
        size: body.length,
        bucket,
      });

      return { success: true, key };
    } catch (error) {
      debugLogger.error("S3 upload failed", { error: error.message, filePath });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a time-limited presigned GET URL for an object.
   *
   * @param {string} key       - Object key
   * @param {number} [expiresIn=3600] - Seconds until the URL expires
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async getPresignedUrl(key, expiresIn = 3600) {
    try {
      const client = this._getClient();
      const bucket = this._getBucket();

      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn }
      );

      return { success: true, url };
    } catch (error) {
      debugLogger.error("S3 presigned URL failed", { error: error.message, key });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an object from S3.
   *
   * @param {string} key - Object key
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteObject(key) {
    try {
      const client = this._getClient();
      const bucket = this._getBucket();

      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key })
      );

      debugLogger.debug("S3 object deleted", { key, bucket });
      return { success: true };
    } catch (error) {
      debugLogger.error("S3 delete failed", { error: error.message, key });
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload a saved recording file to S3 and return a presigned URL.
   * Returns both the key (for later deletion) and the presigned URL
   * (for passing to transcription providers).
   *
   * @param {string} localPath - Path to the saved WAV/audio file
   * @returns {Promise<{success: boolean, key?: string, url?: string, error?: string}>}
   */
  async uploadRecording(localPath) {
    if (!this.isEnabled()) {
      return { success: false, error: "S3 not enabled" };
    }

    const filename = path.basename(localPath);
    const key = `recordings/${filename}`;

    const uploadResult = await this.uploadFile(localPath, { key, contentType: "audio/wav" });
    if (!uploadResult.success) return uploadResult;

    // Also generate a presigned URL so the caller can pass it to transcription providers
    const urlResult = await this.getPresignedUrl(key, 3600);

    return {
      success: true,
      key,
      url: urlResult.success ? urlResult.url : undefined,
    };
  }
}

module.exports = S3StorageManager;
