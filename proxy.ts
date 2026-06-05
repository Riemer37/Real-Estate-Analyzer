import { clerkMiddleware } from '@clerk/nextjs/server';

// All routes are public — auth is optional (freemium model).
// Pro checks happen at component + API level, not at the middleware level.
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
