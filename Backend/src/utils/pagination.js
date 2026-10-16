/**
 * Parse cursor pagination query parameters
 */
export const parseCursorPagination = (query, defaultLimit = 20, maxLimit = 50) => {
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit <= 0) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const cursor = query.cursor ? String(query.cursor).trim() : null;
  return { limit, cursor };
};

/**
 * Format cursor pagination result
 * Checks if items length is greater than limit (we fetch limit + 1)
 */
export const buildCursorResult = (items, limit, cursorField = 'createdAt') => {
  const hasMore = items.length > limit;
  const slicedItems = hasMore ? items.slice(0, limit) : items;
  
  let nextCursor = null;
  if (hasMore && slicedItems.length > 0) {
    const lastItem = slicedItems[slicedItems.length - 1];
    const val = lastItem[cursorField];
    nextCursor = val instanceof Date ? val.toISOString() : String(val);
  }

  return {
    items: slicedItems,
    meta: {
      next_cursor: nextCursor,
      has_more: hasMore,
      count: slicedItems.length,
    },
  };
};

/**
 * Parse standard page/limit pagination
 */
export const parsePagePagination = (query, defaultLimit = 20, maxLimit = 50) => {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit <= 0) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Format page pagination result
 */
export const buildPageResult = (items, total, page, limit) => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    items,
    meta: {
      total,
      page,
      limit,
      total_pages: totalPages,
      has_more: page < totalPages,
    },
  };
};
