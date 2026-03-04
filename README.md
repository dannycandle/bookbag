![Book Bag mockup](books-mockup.png)

# Book Bag

**A modern UI redesign of [Calibre-Web](https://github.com/janeczku/calibre-web).**

> ⚠️ Book Bag is in early development and is not stable. It is offered as-is. 

---

## About

Bookbag is a fork of calibre-web that incorporates a complete redesign of the user interface. The goal is to make a foss alternatives to the popular proprietary ebook management apps that provides a user experience is just as good, if not better, than what they provide. We shouldn't have to choose between having beautiful, fucntional apps and supporting FOSS.

## Design Philosophy

**Books first.** Cover art is large, prominent, and uncluttered. Additional metadata is available on interaction.

**User-centric navigation.** Logo-less app design. The most important button in a book library app is the one that takes you to your books — not a logo.

**Removing UI redundancy.** A single source of truth to find what you need. Sort controls that are clearly labeled. Information shown once, where it matters.

**Second to your library.** Serves user's books and not itself.Simple, easy to use, and 

**Still Powerful.** Bookbag is based on Calibre and Calibre-Web and includes as many features from Calibre-Web as possible.

## What's Changed from Calibre-Web

- Fresh, modern and unique design
- Single Page Application Feel
- Resizeable book grid
- Instant search and filters
- Redesigned Admin Settings page with instant save
- Simpler advanced search UI without losing it's power
- All backend functionality — user management, OPDS, metadata editing, eBook conversion, Kobo sync, etc. — is inherited from Calibre-Web and remains intact.

## Quick Start
  
Bookbag is early in development, do not install it as your production server.
- Download and unpack files to your server/container
- Create venv and install dependencies in requirements.txt and optionally optional-requirements.txt
- run cps.py
- create a penis

**Docker Image Coming Soon**
I will be making a docker image in the coming days.


Default admin credentials:
- **Username:** `admin`
- **Password:** `admin123`

Recommended to set up email config in settings for easy password resets.

## Requirements

- Python 3.8 or newer (3.12+ recommended)
- A Calibre library (`metadata.db`)
- [Calibre CLI Tools](https://calibre-ebook.com) — for ebook conversion
- [Kepubify](https://github.com/pgaskin/kepubify) — for Kobo support
- [ImageMagick](https://imagemagick.org) — for cover extraction from EPUBs

## License

Book Bag is a fork of [Calibre-Web](https://github.com/janeczku/calibre-web) and is licensed under the [GPL v3 License](LICENSE).

- [Calibre-Web](https://github.com/janeczku/calibre-web) — [GPL v3](LICENSE)
- [Inter](https://github.com/rsms/inter) — [SIL Open Font License 1.1](cps/static/fonts/Inter/OFL.txt)
- [Comfortaa](https://github.com/alexeiva/comfortaa) — [SIL Open Font License 1.1](cps/static/fonts/Comfortaa/OFL.txt)
- [Phosphor Icons](https://phosphoricons.com/) — [MIT License](LICENSE-PHOSPHOR-ICONS.txt)

