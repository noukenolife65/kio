FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN curl -fsSL https://fnm.vercel.app/install \
  | bash -s -- -d /usr/local/fnm -s
RUN ln -s /usr/local/fnm/fnm /usr/local/bin/fnm

COPY postcreate.sh /usr/local/bin/postcreate.sh
RUN chmod +x /usr/local/bin/postcreate.sh
