#!/usr/bin/env python3
import json, sys

def search(query):
    query_terms = [q.lower().strip() for q in query.split() if q.strip()]
    if not query_terms:
        return []
    with open("/home/kali/Documents/meeting_brief_testbed/tools/web_index.json") as f:
        data = json.load(f)
    results = []
    for item in data:
        score = sum(1 for term in query_terms if any(term in kw for kw in item["keywords"]) or term in item["title"].lower() or term in item["snippet"].lower())
        if score > 0:
            results.append((score, item))
    results.sort(key=lambda x: x[0], reverse=True)
    return [r[1] for r in results]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
        res = search(q)
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print("Usage: python3 search.py <query>")
