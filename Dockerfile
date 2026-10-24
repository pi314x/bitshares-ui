# BitShares Desk as a container: built from the source, served by nginx.
#
#   docker build -t bitshares-desk .      (--build-arg BRANCH=... --build-arg GIT_REV=... to name it)
#   docker run --rm -p 8080:8080 bitshares-desk          # http://localhost:8080
#
# The image listens on 8080 as an unprivileged user and sends the security headers of
# conf/headers.*.conf (docs/DEPLOYMENT.md). It speaks plain HTTP: put a TLS terminator in front
# of it (a reverse proxy), or use the TLS variant (docker-compose.tls.yml). The wallet must be
# used over HTTPS.

# ---- build ---------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# `yarn install` runs the postinstall that downloads and checks the charting library (the md5 in
# charting_library/ is what it is checked against), so it needs these files and the network.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
COPY charting_library/ ./charting_library/
RUN yarn install --frozen-lockfile --network-concurrency 1

# the build reads no .git folder (it is not in the context): the revision is told to it
ARG BRANCH=container
ARG GIT_REV=unknown
ENV BRANCH=$BRANCH GIT_REV=$GIT_REV

COPY . .
RUN yarn build

# ---- serve ---------------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --from=build /app/build/dist/ /usr/share/nginx/html/
COPY conf/headers.common.conf conf/headers.csp.conf /etc/nginx/
COPY conf/nginx.container.conf /etc/nginx/nginx.conf
COPY conf/nginx.container.tls.conf /etc/nginx/nginx.tls.conf

EXPOSE 8080 8443
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

# The TLS variant: `nginx -c /etc/nginx/nginx.tls.conf -g "daemon off;"` (docker-compose.tls.yml).
CMD ["nginx", "-g", "daemon off;"]
