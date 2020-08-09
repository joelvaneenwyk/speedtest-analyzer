FROM alpine:3.9

LABEL maintainer="Joel Van Eenwyk - <joel.vaneenwyk@gmail.com>"
LABEL author="Tobias Rös - <roes@amicaldo.de>"

# Install dependencies
RUN apk update && apk add \
  bash \
  git \
  nodejs \
  nodejs-npm \
  nginx \
  nginx-mod-http-lua \
  python3 \
  py-pip

RUN pip install speedtest-cli

# Remove default content
RUN rm -R /var/www/*

# Create directory structure
RUN mkdir -p /etc/nginx
RUN mkdir -p /run/nginx
RUN mkdir -p /etc/nginx/global
RUN mkdir -p /var/www/html

# Touch required files
RUN touch /var/log/nginx/access.log && touch /var/log/nginx/error.log

# Install vhost config
ADD ./config/vhost.conf /etc/nginx/conf.d/default.conf
ADD config/nginxEnv.conf /etc/nginx/modules/nginxEnv.conf

# Install webroot files
ADD ./ /var/www/html/

# Install dependencies
RUN npm install -g yarn && cd /var/www/html/ && yarn install

EXPOSE 80
EXPOSE 443

RUN chown -R nginx:nginx /var/www/html/
RUN chmod +x /var/www/html/config/run.sh

ENTRYPOINT ["/var/www/html/config/run.sh"]
