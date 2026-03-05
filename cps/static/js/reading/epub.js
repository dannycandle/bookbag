/* global $, calibre, EPUBJS, ePubReader */

var reader;

(function () {
    "use strict";

    EPUBJS.filePath = calibre.filePath;
    EPUBJS.cssPath = calibre.cssPath;

    reader = ePubReader(calibre.bookUrl, {
        restore: true,
        bookmarks: calibre.bookmark ? [calibre.bookmark] : [],
    });

    Object.keys(themes).forEach(function (theme) {
        reader.rendition.themes.register(theme, themes[theme].css_path);
    });

    // Re-apply reader style overrides on each new page load
    reader.rendition.hooks.content.register(function (contents) {
        if (contents.document && window._injectReaderCSS) {
            window._injectReaderCSS(contents.document);
        }
    });

    if (calibre.useBookmarks) {
        reader.on("reader:bookmarked", updateBookmark.bind(reader, "add"));
        reader.on("reader:unbookmarked", updateBookmark.bind(reader, "remove"));
    } else {
        $("#bookmark, #show-Bookmarks").remove();
    }

    // Swipe support
    var touchStart = 0;
    reader.rendition.on('touchstart', function(event) {
        touchStart = event.changedTouches[0].screenX;
    });
    reader.rendition.on('touchend', function(event) {
        var touchEnd = event.changedTouches[0].screenX;
        var rtl = reader.book.package.metadata.direction === "rtl";
        if (touchStart < touchEnd) {
            rtl ? reader.rendition.next() : reader.rendition.prev();
        } else if (touchStart > touchEnd) {
            rtl ? reader.rendition.prev() : reader.rendition.next();
        }
    });

    var progressDiv = document.getElementById("progress");
    var pagesDiv = document.getElementById("pages-count");

    reader.book.ready.then(() => {
        var locations_key = reader.book.key() + "-locations";
        var position_key = "calibre.reader.position." + reader.book.key();
        var stored = localStorage.getItem(locations_key);
        var make_locations = stored
            ? Promise.resolve(reader.book.locations.load(stored))
            : reader.book.locations.generate();
        var save_locations = stored ? () => {} : () => {
            localStorage.setItem(locations_key, reader.book.locations.save());
        };

        make_locations
            .then(() => {
                // Restore last reading position
                try {
                    var pos = JSON.parse(localStorage.getItem(position_key));
                    if (pos && pos.cfi) reader.rendition.display(pos.cfi);
                } catch (e) {}

                reader.rendition.on("relocated", (location) => {
                    progressDiv.textContent = Math.round(location.end.percentage * 100) + "%";

                    var current = reader.book.locations.locationFromCfi(location.start.cfi) || 0;
                    var total = reader.book.locations.length() || 0;
                    if (total > 0) {
                        pagesDiv.textContent = current + "/" + total;
                        pagesDiv.style.visibility = "visible";
                    } else {
                        pagesDiv.textContent = "";
                        pagesDiv.style.visibility = "hidden";
                    }

                    try {
                        localStorage.setItem(position_key, JSON.stringify({
                            cfi: location.start.cfi,
                            percentage: location.start.percentage,
                        }));
                    } catch (e) {}
                });
                reader.rendition.reportLocation();
                progressDiv.style.visibility = "visible";
            })
            .then(save_locations);
    });

    function updateBookmark(action, location) {
        if (action === "add") {
            this.settings.bookmarks.forEach(function (bookmark) {
                if (bookmark && bookmark !== location) this.removeBookmark(bookmark);
            }.bind(this));
        }
        var csrftoken = $("input[name='csrf_token']").val();
        $.ajax(calibre.bookmarkUrl, {
            method: "post",
            data: { bookmark: location || "" },
            headers: { "X-CSRFToken": csrftoken },
        }).fail(function (xhr, status, error) {
            alert(error);
        });
    }

    // Restore settings
    var theme = localStorage.getItem("calibre.reader.theme") ?? "lightTheme";
    selectTheme(theme);

    reader.book.ready.then(() => {
        var s;
        if (s = localStorage.getItem("calibre.reader.fontSize"))
            reader.rendition.themes.fontSize(s + "%");
        if (s = localStorage.getItem("calibre.reader.fontWeight"))
            window._readerFontWeight = s;
        if (s = localStorage.getItem("calibre.reader.textAlign"))
            window._readerTextAlign = s;
        s = localStorage.getItem("calibre.reader.font");
        if (s === "default") s = "Inter";
        if (s && window.selectFont) window.selectFont(s);
        if (s = localStorage.getItem("calibre.reader.lineSpacing"))
            reader.rendition.themes.override("line-height", s, true);
    });
})();
