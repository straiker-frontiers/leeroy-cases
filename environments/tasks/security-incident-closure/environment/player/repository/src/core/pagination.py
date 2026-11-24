def paginate(items, page=1, page_size=25):
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "page": page, "total": len(items)}
