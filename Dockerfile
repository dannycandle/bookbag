FROM python:3.13-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    libxml2 libxslt1.1 \
    imagemagick libmagickwand-dev \
    libldap-common libldap2 libsasl2-2 libldap-dev libsasl2-dev \
    unrar-free \
    build-essential libffi-dev \
    libegl1 libopengl0 libxcb-cursor0 libfreetype6 \
    curl xdg-utils xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L https://download.calibre-ebook.com/linux-installer.sh | sh /dev/stdin install_dir=/opt \
    && curl -L https://github.com/pgaskin/kepubify/releases/latest/download/kepubify-linux-64bit \
    -o /usr/local/bin/kepubify && chmod +x /usr/local/bin/kepubify

# Strip Calibre: remove GUI/WebEngine libs, docs, locales, unneeded binaries
RUN cd /opt/calibre && \
    rm -rf \
        resources/content-server \
        resources/editor \
        resources/images \
        resources/localization/locales \
        resources/calibre-portable.* \
        resources/qtwebengine_devtools_resources.pak \
        resources/viewer.js \
        resources/dictionaries \
        calibre calibre-debug calibre-server calibre-smtp \
        calibre-complete ebook-device ebook-edit ebook-viewer \
        fetch-ebook-metadata lrf2lrs lrfviewer web2disk \
        lib/libQt6WebEngine*.so* \
        lib/libQt6Quick*.so* \
        lib/libQt6Qml*.so* \
        lib/libQt6Designer*.so* \
        lib/libQt6Pdf*.so* \
        lib/libavcodec*.so* \
        lib/libavfilter*.so* \
        lib/libavformat*.so* \
        lib/libavutil*.so* \
        lib/libswresample*.so* \
        lib/libswscale*.so* \
        lib/libonnxruntime*.so* \
        lib/libvpx*.so* \
        lib/libopus*.so* \
        lib/libre2*.so* \
    && find . -name '*.pyc' -delete \
    && find . -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true \
    && strip --strip-unneeded lib/*.so* 2>/dev/null || true

COPY requirements.txt optional-requirements.txt /tmp/
RUN pip install --no-cache-dir --prefix=/install \
    -r /tmp/requirements.txt -r /tmp/optional-requirements.txt \
    && pip uninstall -y --target=/install/lib/python3.13/site-packages \
        selenium sphinx sphinx-rtd-theme sphinxcontrib-applehelp \
        sphinxcontrib-devhelp sphinxcontrib-htmlhelp sphinxcontrib-jsmath \
        sphinxcontrib-qthelp sphinxcontrib-serializinghtml \
        pygments docutils alabaster Jinja2 snowballstemmer \
        imagesize pip setuptools 2>/dev/null || true \
    && rm -rf /install/lib/python3.13/site-packages/selenium \
        /install/lib/python3.13/site-packages/sphinx* \
        /install/lib/python3.13/site-packages/pygments \
        /install/lib/python3.13/site-packages/pip \
        /install/lib/python3.13/site-packages/setuptools \
        /install/lib/python3.13/site-packages/docutils \
        /install/lib/python3.13/site-packages/alabaster \
        /install/lib/python3.13/site-packages/snowballstemmer \
        /install/lib/python3.13/site-packages/imagesize \
    && find /install -type d -name 'tests' -exec rm -rf {} + 2>/dev/null || true \
    && find /install -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true \
    && find /install -name '*.pyc' -delete 2>/dev/null || true \
    && find /install -name '*.pyo' -delete 2>/dev/null || true \
    && find /install -type d -name '*.dist-info' -exec rm -rf {} + 2>/dev/null || true

FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    libxml2 libxslt1.1 \
    libmagickwand-7.q16hdri-10 imagemagick-7-common \
    libldap-common libldap2 libsasl2-2 \
    unrar-free \
    libegl1 libopengl0 libxcb-cursor0 libfreetype6 \
    xdg-utils \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/man /usr/share/doc /usr/share/man /usr/share/locale \
    && find /usr/lib -name '*.so' -exec strip --strip-unneeded {} + 2>/dev/null || true

COPY --from=builder /install /usr/local
COPY --from=builder /opt/calibre /opt/calibre
COPY --from=builder /usr/local/bin/kepubify /usr/local/bin/kepubify

COPY . .

EXPOSE 8084

CMD ["python", "cps.py"]
