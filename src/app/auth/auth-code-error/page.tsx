import Link from "next/link";
import FocusLayout from "@/components/layouts/FocusLayout";

export default function AuthCodeErrorPage() {
    return (
        <FocusLayout
            title="Link Expired"
            description="This confirmation link has expired or is invalid. Please try signing up again or request a new confirmation email."
        >
            <div className="flex flex-col items-center justify-center pt-4 pb-8">
                <div aria-hidden="true" className="mb-6 text-[4rem]">
                    ⚠️
                </div>
                
                <div className="flex w-full flex-col gap-3 sm:max-w-xs">
                    <Link
                        href="/signup"
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-forest px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-forest/90"
                        id="retry-signup"
                    >
                        Sign Up Again
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-8 py-2 text-sm font-semibold text-stone-600 transition-all hover:bg-stone-50 hover:text-stone-900"
                        id="go-to-login"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </FocusLayout>
    );
}
