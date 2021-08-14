FROM fabiocicerchia/nginx-lua:1.21.1-alpine

LABEL author="Tobias Rös - <roes@amicaldo.de>"
LABEL maintainer="Joel Van Eenwyk - <joel.vaneenwyk@gmail.com>"

ARG NginxWebRoot=/usr/share/nginx/html

ENV NGINX_WEB_ROOT=${NginxWebRoot}
ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates

# Install dependencies
RUN apk update && apk add \
  bash \
  git \
  nodejs \
  npm \
  python3 \
  py3-pip

RUN pip3 install speedtest-cli

RUN npm install -g yarn

# Create directory structure and required files if they do not exist
RUN \
mkdir -p /run/nginx/ \
&& mkdir -p /etc/nginx/global/ \
&& mkdir -p ${NginxWebRoot}/ \
&& mkdir -p ${NginxWebRoot}/logs/ \
&& mkdir -p /etc/nginx/modules/ \
&& touch /var/log/nginx/access.log \
&& touch /var/log/nginx/error.log

# Default web content goes here in newer versions of nginx
WORKDIR ${NginxWebRoot}

# Copy over all files
COPY ./ ./

# Install dependencies
RUN yarn install

# Install default configuration. We use a template here which handles variable substitution for
# us, see https://github.com/docker-library/docs/tree/master/nginx#using-environment-variables-in-nginx-configuration
RUN \
mkdir -p $NGINX_ENVSUBST_TEMPLATE_DIR/ \
&& cp -a "${NginxWebRoot}/templates/." "$NGINX_ENVSUBST_TEMPLATE_DIR/" \
&& cp -f "${NginxWebRoot}/config/nginxEnv.conf" "/etc/nginx/modules/nginxEnv.conf"

# Update permissions so that nginx server can touch/modify files as needed
RUN chown -R nginx:nginx ${NginxWebRoot}/
RUN chmod a+x ${NginxWebRoot}/config/run.sh
RUN chmod a+x ${NginxWebRoot}/scripts/runSpeedtest.py

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["sh", "-c", "$NGINX_WEB_ROOT/config/run.sh"]
