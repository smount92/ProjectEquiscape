import * as Sentry from "@sentry/nextjs";

/** The slice of a Supabase client this helper needs. */
interface StorageClient {
    storage: {
        from(bucket: string): {
            upload(
                path: string,
                body: Blob,
                options: { contentType: string; upsert?: boolean },
            ): Promise<{ error: { message: string } | null }>;
        };
    };
}

/**
 * Upload an image to Supabase Storage with ONE automatic retry.
 *
 * Photo uploads run from the browser over collectors' phone
 * connections — a single transient failure used to silently lose the
 * photo (no retry, and add-horse ignored the error entirely). The
 * retry absorbs the transient case; a second failure is reported to
 * Sentry so silent loss shows up in telemetry, and returned to the
 * caller so it can tell the user.
 */
export async function uploadImageWithRetry(
    client: StorageClient,
    bucket: string,
    path: string,
    body: Blob,
    contentType = "image/webp",
): Promise<{ error: { message: string } | null }> {
    let { error } = await client.storage.from(bucket).upload(path, body, { contentType });
    if (error) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        ({ error } = await client.storage
            .from(bucket)
            .upload(path, body, { contentType, upsert: true }));
    }
    if (error) {
        Sentry.captureException(new Error(`Image upload failed after retry: ${error.message}`), {
            tags: { domain: "photo-upload" },
            extra: { bucket, path },
        });
    }
    return { error };
}
