// Split out from favorite-categories.ts so server-only code (the /api/favorites
// route) doesn't have to pull in SidebarFilters, a "use client" component.
export const MAX_CATEGORY_LENGTH = 40;
