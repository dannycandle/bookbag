FROM python:3.13-slim

WORKDIR /app

# System dependencies for python-magic, lxml, Wand (ImageMagick), and Calibre
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    libxml2 \
    libxslt1.1 \
    imagemagick \
    libmagickwand-dev \
    calibre \
    curl \
    && curl -L https://github.com/pgaskin/kepubify/releases/latest/download/kepubify-linux-64bit -o /usr/local/bin/kepubify \
    && chmod +x /usr/local/bin/kepubify \
    && apt-get remove -y curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt optional-requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r optional-requirements.txt

# Application code
COPY . .

# Calibre CLI lives at /usr/bin — configure this in admin as the binaries path
ENV CALIBRE_BINARIES_DIR=/usr/bin

EXPOSE 8083

CMD ["python", "cps.py"]
