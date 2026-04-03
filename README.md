# Bookbag
![Book Bag mockup](./readme-assets/bookbag-mockup.png)

## About

Bookbag is a fork of [Calibre-Web](https://github.com/janeczku/calibre-web) that incorporates a complete redesign of the user interface. It is fully self-hostable and has no user tracking or telemetry.

## Features
![Instant Loads](./readme-assets/instant.gif)
- **Instant Filters, Search, Sort, and Resize:** Instantly sort, search, filter, and resize book covers.
- **Advanced Search:** Search using any combination of metadata.
- **Advanced Settings:** One page with instantly applied settings.
- **Easy Setup Wizard:** First-time setup wizard to create admin account and create/upload book library.
- **Advanced Web Reader:** Font, text size, themes, line height, justification, & columns.
- **One-Time-Password Flow:** For password resets and public registrations.
- **Most of what Calibre-Web Includes:** Retains features such as Kobo Sync, email to ereader, magic links, ldap & oauth, etc., although many need further testing.


## Planned Future Updates (Dates TBD):
- **Responsive Design** (In progress)
- **Magic Shelves** (In progress)
- **Dark Mode** (In progress)
- **Bulk Editing**
- **Author's Page**
- **Audiobooks**
- **Auto-ingest**
- **Metadata Automation**
- **Deduplication**
- **Free eBook Discovery**
- **Ebook upload sanitation (for security)**
- **Website**

## Change log
v0.1.2: Shelves fully implemented. Create/edit/delete from books grid. Create/AddBook from book details page.
v0.1.1: Use backend for filters & search, builds now support amd64.
v0.1.0: Initial release. Base features implemented with redesign.

## Install via Docker
1. Download docker-compose.yml from this repo.
2. In the file, replace "PATH/FOR/YOUR/LIBRARY/FOLDER" (stores metadata.db and book files) and "PATH/FOR/YOUR/CONFIG/FOLDER" (stores app.db and other install-specific files) with the paths you want. Map your desired port to container port 8084.
3. Run `docker compose up -d`

> ⚠️ While I have tested bookbag for release 0.1.0, I still advise against using it on a public server or as your primary book server. There may be vulnerabilities and bugs that prevent normal use. Bookbag is still in early development and is offered as-is.

## First-Time User Setup
Follow the setup wizard after starting the server.
1. Create admin account.
2. If you are bringing your own metadata.db, choose "Bring my own". You can then upload your metadata.db file. The book files themselves must still be manually placed in the folder your metadata.db expects, usually the same folder as the metadata.db file (/books in container, ./books for dev environments).
3. If you want to start with a fresh (empty) library, choose "Start fresh". A new metadata.db file with a unique uuid is created.
4. It is recommended you go to the settings page and set up email so you can easily reset passwords, etc.

## Set up a development environment
### 1. Clone repository

`git clone https://codeberg.org/bookbag/bookbag.git && cd bookbag`

### 2. Install system dependencies*

- **Debian 13:** `sudo apt install -y python3-dev gcc g++ libffi-dev libmagic-dev libxml2-dev libxslt1-dev imagemagick libmagickwand-dev libldap2-dev libsasl2-dev unrar-free`

- **Fedora 43:** `sudo dnf install -y python3-devel gcc gcc-c++ openssl-devel cyrus-sasl-devel libffi-devel libxml2-devel libxslt-devel ImageMagick ImageMagick-devel openldap-devel`

- **MacOS:** `xcode-select --install` and `brew install python libmagic imagemagick libxml2 libxslt libffi openssl`

*These are general guidelines, package names and requirements may vary based on your system. If you are missing system dependencies, pip installs in step 3 may fail.

### 3. Create venv and install python packages

Linux
```
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r optional-requirements.txt
```

MacOS
```
$(brew --prefix python@3.14)/bin/python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r optional-requirements.txt
```

If builds in this stage fail, it is likely that you are missing a system dependency, go back to step 2.

### 4. Define environment
`echo "BOOKBAG_LIBRARY_PATH=/FULL/PATH/TO/PROJECT/books" > .env`

### 5. Start server in debug mode

`FLASK_DEBUG=1 python cps.py`

## License

Bookbag is a fork of [Calibre-Web](https://github.com/janeczku/calibre-web) and is licensed under the [GPL v3 License](LICENSE).

Many thanks to the following projects:
- [Calibre-Web](https://github.com/janeczku/calibre-web) — [GPL v3](LICENSE)
- [Inter](https://github.com/rsms/inter) — [SIL Open Font License 1.1](cps/static/fonts/Inter/OFL.txt)
- [Comfortaa](https://github.com/alexeiva/comfortaa) — [SIL Open Font License 1.1](cps/static/fonts/Comfortaa/OFL.txt)
- [Phosphor Icons](https://phosphoricons.com/) — [MIT License](LICENSE-PHOSPHOR-ICONS.txt)