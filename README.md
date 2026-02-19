![Book Bag mockup](books-mockup.png)

# Book Bag

**A modern UI redesign of [Calibre-Web](https://github.com/janeczku/calibre-web).**

> ⚠️ Book Bag is in early development and is not stable. It is offered as-is. Please do not open issues requesting troubleshooting help.

---

## Why

Calibre-Web is a remarkable piece of software. It breathes new life into personal ebook libraries and offers a real alternative to the corporate platforms — Amazon, Google, Kobo — that want to lock your reading life inside their ecosystem. Finding it genuinely felt like a revelation.

But the interface hasn't kept pace with what users have come to expect from modern software. Eight unlabeled sort buttons. Book titles displayed twice per book, right next to the cover that already has the title on it. Two search bars. Two admin buttons. Rounded corners mixed with sharp ones. The design makes it hard to fall in love with what you're actually there for: your books.

Book Bag is an attempt to answer the question: *what would Calibre-Web look like with a clear, consistent, and opinionated design language — one that gets out of the way and puts the books front and center?*

## Design Philosophy

**Books first.** Cover art is large, prominent, and uncluttered. Additional metadata is available on interaction, not plastered everywhere by default.

**Navigation on the left.** On desktop, the left side of the screen carries the most visual weight. The most important button in a book library app should be the one that takes you to your books — not a logo.

**No redundancy.** One search. Sort controls that are clearly labeled. Information shown once, where it matters.

**Out of the way.** The app should serve the user's relationship with their books, not demand attention for itself.

## What's Changed from Calibre-Web

- Vanilla CSS replacing Bootstrap
- New left-side sticky navigation bar
- Redesigned book grid — cover art only, no duplicate metadata
- Action bar with labeled sort dropdown and integrated search
- Filter sidebar (in progress)
- Many upstream GUI features may be temporarily inaccessible while the UI is rebuilt

All backend functionality — user management, OPDS, metadata editing, eBook conversion, Kobo sync, etc. — is inherited from Calibre-Web and remains intact.

## Quick Start

Book Bag runs identically to Calibre-Web. Refer to the [Calibre-Web documentation](https://github.com/janeczku/calibre-web/wiki) for setup instructions.

Default admin credentials:
- **Username:** `admin`
- **Password:** `admin123`

Change these immediately after first login.

## Requirements

- Python 3.7 or newer
- A Calibre library (`metadata.db`)
- Optionally: Calibre desktop app (for conversion), Kepubify (for Kobo support), ImageMagick (for cover extraction from EPUBs)

## License

Book Bag is a fork of [Calibre-Web](https://github.com/janeczku/calibre-web) and is licensed under the [GPL v3 License](LICENSE).
