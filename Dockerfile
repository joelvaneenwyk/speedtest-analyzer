FROM fabiocicerchia/nginx-lua:1.21.1-alpine

LABEL author="Tobias Rös - <roes@amicaldo.de>"
LABEL maintainer="Joel Van Eenwyk - <joel.vaneenwyk@gmail.com>"

ARG NginxRoot=/usr/share/nginx
ARG NginxWebRoot=/usr/share/nginx/html
ARG SSL_CERTIFICATE_ROOT="/etc/nginx/ssl"

ENV NGINX_ROOT=${NginxRoot}
ENV NGINX_WEB_ROOT=${NginxRoot}/html
ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates
ENV SSL_CERTIFICATE_ROOT=${SSL_CERTIFICATE_ROOT}
ENV SSL_ROOT_NAME="speedtest_analyzer"

# Install dependencies
RUN apk update && apk add \
    bash \
    git \
    nodejs \
    npm \
    openssl \
    python3 \
    py3-pip

RUN npm install -g yarn

# This is the utility we use for testing connection speed
RUN python3 -m pip install speedtest-cli

# Create directory structure and required files if they do not exist
RUN \
    mkdir -p /run/nginx/ \
    && mkdir -p /etc/nginx/global/ \
    && mkdir -p $NGINX_WEB_ROOT/ \
    && mkdir -p $NGINX_WEB_ROOT/logs/ \
    && mkdir -p /etc/nginx/modules/ \
    && touch /var/log/nginx/access.log \
    && touch /var/log/nginx/error.log

WORKDIR /usr/share/nginx/

# Copy over all files
COPY ./ ./

# Install dependencies
RUN yarn workspaces focus --production

RUN yarn production

# Install default configuration. We use a template here which handles variable substitution for
# us, see https://github.com/docker-library/docs/tree/master/nginx#using-environment-variables-in-nginx-configuration
RUN \
    mkdir -p $NGINX_ENVSUBST_TEMPLATE_DIR/ \
    && cp -f "./src/config/nginx/default.conf.template" "$NGINX_ENVSUBST_TEMPLATE_DIR/default.conf.template" \
    && cp -f "./src/config/nginx/nginxEnv.conf" "/etc/nginx/modules/nginxEnv.conf"

# Update permissions so that nginx server can touch/modify files as needed
RUN \
    chown -R nginx:nginx ./ \
    && chmod a+x ./src/server/*.sh \
    && chmod a+x ./src/server/runSpeedtest.py

# Create self-signed SSL certificates
RUN ./src/server/generateCertificate.sh

RUN \
    rm -rf ./mypy_cache \
    && rm -rf ./yarn \
    && rm -rf ./src/frontend \
    && rm -rf ./src/config \
    && rm ./.pnp.cjs

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["sh", "-c", "$NGINX_ROOT/src/server/run.sh"]
