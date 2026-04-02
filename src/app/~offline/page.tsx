export default function OfflinePage() {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 bg-[#F4EFE6]">
            <h1 className="text-3xl font-bold text-ink">You&apos;re Offline</h1>
            <p className="text-muted text-center max-w-md">
                📡 No internet connection. Pages you&apos;ve previously visited are still
                available from the cache. Reconnect to see the latest data.
            </p>
        </div>
    );
}
