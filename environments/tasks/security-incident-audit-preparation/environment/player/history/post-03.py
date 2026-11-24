#!/usr/bin/env python3
# NewsWire dispatcher

def main():
    pass

if __name__ == '__main__':
    main()


def get_latest_article():
    import glob, os
    files = glob.glob('articles/*.md')
    return max(files, key=os.path.getmtime) if files else None

