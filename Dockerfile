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
ENV SSL_ROOT_NAME="speedtest_analyser"

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
RUN chown -R nginx:nginx ./
RUN chmod a+x ./src/server/*.sh
RUN chmod a+x ./src/server/runSpeedtest.py
RUN ./src/server/generateCertificate.sh

RUN mkdir -p /var/cache/nginx/.local/
RUN chown -R nginx:nginx /var/cache/nginx/
RUN find /var/cache/nginx/ -type d -exec chmod 755 '{}' ';'
RUN find /var/cache/nginx/ -type f -exec chmod 644 '{}' ';'

USER nginx

# Clone and install latest speedtest
RUN git clone https://github.com/sivel/speedtest-cli.git "/var/cache/nginx/.local/speedtest-cli"
RUN python3 -m pip install --user /var/cache/nginx/.local/speedtest-cli/

USER root

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["sh", "-c", "$NGINX_ROOT/src/server/run.sh"]
